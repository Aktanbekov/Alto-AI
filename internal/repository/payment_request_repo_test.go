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
