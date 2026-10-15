package repository

import "testing"

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
	if want := "postgresql://example.invalid/alto?sslmode=require"; got != want {
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
	if want := "postgresql://example.invalid/vercel?sslmode=require"; got != want {
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
