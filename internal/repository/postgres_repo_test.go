package repository

import (
	"strings"
	"testing"
)

func TestPostgresConnectionStringPrefersURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://example.invalid/alto?sslmode=require")
	t.Setenv("POSTGRES_HOST", "localhost")
	t.Setenv("POSTGRES_PORT", "5432")
	t.Setenv("POSTGRES_USER", "alto")
	t.Setenv("POSTGRES_PASSWORD", "secret")
	t.Setenv("POSTGRES_DB", "alto")

	got, err := postgresConnectionString()
	if err != nil {
		t.Fatalf("postgresConnectionString returned an error: %v", err)
	}
	if want := "postgresql://example.invalid/alto?sslmode=require&binary_parameters=yes"; got != want {
		t.Fatalf("postgresConnectionString = %q, want %q", got, want)
	}
}

func TestPostgresConnectionStringUsesVercelURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("POSTGRES_URL", "postgresql://example.invalid/vercel?sslmode=require")

	got, err := postgresConnectionString()
	if err != nil {
		t.Fatalf("postgresConnectionString returned an error: %v", err)
	}
	if want := "postgresql://example.invalid/vercel?sslmode=require&binary_parameters=yes"; got != want {
		t.Fatalf("postgresConnectionString = %q, want %q", got, want)
	}
}

func TestPostgresConnectionStringRejectsIncompleteConfig(t *testing.T) {
	for _, key := range []string{
		"DATABASE_URL",
		"POSTGRES_URL",
		"POSTGRES_URL_NON_POOLING",
		"POSTGRES_PRISMA_URL",
		"POSTGRES_HOST",
		"POSTGRES_PORT",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
	} {
		t.Setenv(key, "")
	}

	if _, err := postgresConnectionString(); err == nil {
		t.Fatal("postgresConnectionString should reject an incomplete configuration")
	}
}

// Every connection string must be safe behind Supabase's transaction pooler;
// without binary_parameters, queries fail at random with "pq: unnamed
// prepared statement does not exist".
func TestPoolerSafe(t *testing.T) {
	for in, want := range map[string]string{
		"postgresql://u:p@pooler.supabase.com:6543/postgres":                  "postgresql://u:p@pooler.supabase.com:6543/postgres?binary_parameters=yes",
		"postgresql://h/db?sslmode=require":                                   "postgresql://h/db?sslmode=require&binary_parameters=yes",
		"postgresql://h/db?binary_parameters=no":                              "postgresql://h/db?binary_parameters=no",
		"host=localhost port=5432 user=a password=b dbname=c sslmode=disable": "host=localhost port=5432 user=a password=b dbname=c sslmode=disable binary_parameters=yes",
	} {
		if got := poolerSafe(in); got != want {
			t.Errorf("poolerSafe(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPostgresConnectionStringFieldsArePoolerSafe(t *testing.T) {
	for _, key := range []string{"DATABASE_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "POSTGRES_PRISMA_URL"} {
		t.Setenv(key, "")
	}
	t.Setenv("POSTGRES_HOST", "localhost")
	t.Setenv("POSTGRES_PORT", "5432")
	t.Setenv("POSTGRES_USER", "alto")
	t.Setenv("POSTGRES_PASSWORD", "secret")
	t.Setenv("POSTGRES_DB", "alto")
	got, err := postgresConnectionString()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(got, " binary_parameters=yes") {
		t.Fatalf("connection string %q is missing binary_parameters=yes", got)
	}
}
