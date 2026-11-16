package handlers

import (
	"testing"

	"altoai_mvp/internal/models"
	"altoai_mvp/internal/repository"
)

func TestSummarizePlan(t *testing.T) {
	if summarizePlan(nil) != nil {
		t.Fatal("no requests should mean no plan")
	}
	got := summarizePlan([]repository.PaymentRequest{
		{Plan: "full", Price: 1999, Outcome: "pending"},
		{Plan: "quick", Price: 999, Outcome: "bought", GrantedSets: 3},
		{Plan: "complete", Price: 8500, Outcome: "bought", GrantedSets: 100},
	})
	if got.Status != "paid" || got.Plan != "complete" || got.Rounds != 103 {
		t.Fatalf("paid summary = %+v", got)
	}
	got = summarizePlan([]repository.PaymentRequest{
		{Plan: "full", Outcome: "pending"}, {Plan: "quick", Outcome: "declined"},
	})
	if got.Status != "requested" || got.Plan != "full" {
		t.Fatalf("requested summary = %+v", got)
	}
	got = summarizePlan([]repository.PaymentRequest{{Plan: "quick", Outcome: "declined"}})
	if got.Status != "declined" {
		t.Fatalf("declined summary = %+v", got)
	}
}

func TestRequestsByUserFallsBackToEmail(t *testing.T) {
	users := []models.User{{ID: "u1", Email: "A@x.com"}, {ID: "u2", Email: "b@x.com"}}
	grouped := requestsByUser(users, []repository.PaymentRequest{
		{ID: "r1", UserID: "u1"},
		{ID: "r2", Email: "a@X.com"}, // not linked, matched by email
		{ID: "r3", Email: "nobody@x.com"},
	})
	if len(grouped["u1"]) != 2 || len(grouped["u2"]) != 0 {
		t.Fatalf("grouped = %+v", grouped)
	}
}
