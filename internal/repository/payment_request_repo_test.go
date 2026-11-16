package repository

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// Runs against a real Postgres only when ALTO_PG_TEST=1, inside a throwaway
// schema that is dropped afterwards, so it never touches the app's own tables.
func testDB(t *testing.T) *sql.DB {
	t.Helper()
	if os.Getenv("ALTO_PG_TEST") != "1" {
		t.Skip("set ALTO_PG_TEST=1 to run against Postgres")
	}
	dsn, err := postgresConnectionString()
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}
	schema := fmt.Sprintf("alto_test_%d", time.Now().UnixNano())
	admin, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(`CREATE SCHEMA ` + schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		admin.Exec(`DROP SCHEMA ` + schema + ` CASCADE`)
		admin.Close()
	})
	sep := " "
	if strings.Contains(dsn, "://") {
		sep = "&"
		if !strings.Contains(dsn, "?") {
			sep = "?"
		}
		dsn += sep + "search_path=" + schema
	} else {
		dsn += sep + "search_path=" + schema
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	if err := EnsureValidationSchema(db); err != nil {
		t.Fatal(err)
	}
	if err := EnsurePaymentRequestSchema(db); err != nil {
		t.Fatal(err)
	}
	if err := EnsureReferralSchema(db); err != nil {
		t.Fatal(err)
	}
	if err := EnsureAnalyticsSchema(db); err != nil {
		t.Fatal(err)
	}
	if err := EnsureEvaluationSchema(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestBoughtGrantsAndRevokesPlan(t *testing.T) {
	db := testDB(t)
	repo := NewPaymentRequestRepo(db, map[string]int{"full": 10})
	val := NewValidationRepo(db)
	user := Subject{UserID: "11111111-1111-1111-1111-111111111111"}

	req, err := repo.Create(PaymentRequest{
		UserID: user.UserID, Email: "a@example.com", Name: "A", Phone: "+996555123456",
		Plan: "full", Price: 1999, Contact: "whatsapp",
	})
	if err != nil {
		t.Fatal(err)
	}

	bought, declined, yes := "bought", "declined", true
	got, err := repo.Update(req.ID, PaymentRequestUpdate{Outcome: &bought, Contacted: &yes})
	if err != nil {
		t.Fatalf("mark bought: %v", err)
	}
	if got.GrantedSets != 10 || got.GrantedAt == nil || !got.Contacted || got.ContactedAt == nil {
		t.Fatalf("after bought: %+v", got)
	}
	// Pressing it again must not grant twice.
	if _, err := repo.Update(req.ID, PaymentRequestUpdate{Outcome: &bought}); err != nil {
		t.Fatal(err)
	}
	if n, _ := val.ExtraSets(user); n != 10 {
		t.Fatalf("extra sets = %d, want 10", n)
	}
	if paid, _ := val.HasPaidPlan(user); !paid {
		t.Fatal("HasPaidPlan = false after bought")
	}

	got, err = repo.Update(req.ID, PaymentRequestUpdate{Outcome: &declined})
	if err != nil {
		t.Fatalf("mark declined: %v", err)
	}
	if got.GrantedSets != 0 || got.GrantedAt != nil {
		t.Fatalf("after declined: %+v", got)
	}
	if n, _ := val.ExtraSets(user); n != 0 {
		t.Fatalf("extra sets after revoke = %d, want 0", n)
	}
	if paid, _ := val.HasPaidPlan(user); paid {
		t.Fatal("HasPaidPlan = true after revoke")
	}
}

func TestBoughtNeedsAccount(t *testing.T) {
	db := testDB(t)
	repo := NewPaymentRequestRepo(db, map[string]int{"full": 10})
	req, err := repo.Create(PaymentRequest{Name: "B", Phone: "+996555123456", Plan: "full", Price: 1999, Contact: "whatsapp"})
	if err != nil {
		t.Fatal(err)
	}
	bought := "bought"
	if _, err := repo.Update(req.ID, PaymentRequestUpdate{Outcome: &bought}); err != ErrPaymentNoAccount {
		t.Fatalf("got %v, want ErrPaymentNoAccount", err)
	}
}

func TestForUsersMatchesByIDOrEmail(t *testing.T) {
	db := testDB(t)
	repo := NewPaymentRequestRepo(db, map[string]int{"full": 10})
	mk := func(userID, email string) {
		if _, err := repo.Create(PaymentRequest{UserID: userID, Email: email, Name: "x", Phone: "+1 555 0100",
			Plan: "full", Price: 1999, Contact: "whatsapp"}); err != nil {
			t.Fatal(err)
		}
	}
	mk("u1", "one@x.com")
	mk("", "ONE@x.com")
	mk("u2", "two@x.com")
	got, err := repo.ForUsers([]string{"u1"}, []string{"one@x.com"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d requests, want 2", len(got))
	}
}

func TestCommission(t *testing.T) {
	for _, c := range []struct{ price, pct, want int }{
		{1999, 20, 400}, {999, 10, 100}, {8500, 15, 1275}, {1999, 0, 0}, {1999, 150, 1999}, {0, 20, 0},
	} {
		if got := Commission(c.price, c.pct); got != c.want {
			t.Errorf("Commission(%d, %d) = %d, want %d", c.price, c.pct, got, c.want)
		}
	}
}

// A sale through a partner link earns the rate in force when it is marked
// bought, is paid out once, and is never paid twice by re-marking it.
func TestPartnerCommissionAndPayout(t *testing.T) {
	db := testDB(t)
	links := NewReferralRepo(db)
	if _, err := links.Create(ReferralLink{Code: "aziz", Destination: "/", PartnerName: "Aziz", CommissionPct: 20}); err != nil {
		t.Fatal(err)
	}
	repo := NewPaymentRequestRepo(db, map[string]int{"full": 10})
	req, err := repo.Create(PaymentRequest{
		UserID: "u1", Email: "a@example.com", Name: "A", Phone: "+996555123456",
		Plan: "full", Price: 1999, Contact: "whatsapp", RefCode: "aziz",
	})
	if err != nil {
		t.Fatal(err)
	}
	bought, declined := "bought", "declined"
	got, err := repo.Update(req.ID, PaymentRequestUpdate{Outcome: &bought})
	if err != nil {
		t.Fatal(err)
	}
	if got.RefCode != "aziz" || got.Commission != 400 || got.CommissionPaidAt != nil {
		t.Fatalf("after bought: ref=%q commission=%d paid=%v", got.RefCode, got.Commission, got.CommissionPaidAt)
	}

	// A new rate does not rewrite a sale already counted.
	if _, err := links.UpdatePartner("aziz", PartnerInfo{PartnerName: "Aziz", CommissionPct: 50}); err != nil {
		t.Fatal(err)
	}
	amount, sales, err := repo.MarkCommissionPaid("aziz")
	if err != nil || amount != 400 || sales != 1 {
		t.Fatalf("payout = %d som, %d sales, %v; want 400, 1", amount, sales, err)
	}
	if amount, _, _ := repo.MarkCommissionPaid("aziz"); amount != 0 {
		t.Fatalf("second payout = %d, want 0", amount)
	}

	// Taking the sale back and marking it bought again must not owe it twice.
	if _, err := repo.Update(req.ID, PaymentRequestUpdate{Outcome: &declined}); err != nil {
		t.Fatal(err)
	}
	got, err = repo.Update(req.ID, PaymentRequestUpdate{Outcome: &bought})
	if err != nil {
		t.Fatal(err)
	}
	if got.Commission != 400 || got.CommissionPaidAt == nil {
		t.Fatalf("re-bought: commission=%d paid=%v, want 400 and still paid", got.Commission, got.CommissionPaidAt)
	}
	referred, err := repo.Referred()
	if err != nil || len(referred) != 1 {
		t.Fatalf("Referred = %d rows, %v", len(referred), err)
	}
}
