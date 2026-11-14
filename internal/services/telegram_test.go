package services

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"altoai_mvp/internal/repository"
)

type memSettings map[string]string

func (m memSettings) Get(k string) (string, error) { return m[k], nil }
func (m memSettings) Set(k, v string) error        { m[k] = v; return nil }
func (m memSettings) Delete(k string) error        { delete(m, k); return nil }

func TestPaymentRequestMessageEscapesInput(t *testing.T) {
	msg := PaymentRequestMessage(repository.PaymentRequest{
		Name: `<b>x</b> & "y"`, Phone: "+996 555 123 456", Plan: "full", Price: 1999,
		Contact: "whatsapp", InterviewDate: "2026-12-01",
	}, "Полная подготовка", "https://altovisas.com/admin")
	if strings.Contains(msg, "<b>x</b>") {
		t.Fatalf("name was not escaped: %s", msg)
	}
	for _, want := range []string{"&lt;b&gt;x&lt;/b&gt; &amp;", "https://wa.me/996555123456", "01.12.2026", "1999 сом"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message missing %q:\n%s", want, msg)
		}
	}
}

// A fake Bot API: getMe, getUpdates with one matching /start, and sendMessage.
func TestTelegramConnectAndSend(t *testing.T) {
	var sent []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var in map[string]any
		_ = json.Unmarshal(body, &in)
		switch {
		case strings.HasSuffix(r.URL.Path, "/getMe"):
			io.WriteString(w, `{"ok":true,"result":{"username":"alto_test_bot"}}`)
		case strings.HasSuffix(r.URL.Path, "/getUpdates"):
			io.WriteString(w, `{"ok":true,"result":[
				{"message":{"text":"/start wrongcode","chat":{"id":1,"type":"private"}}},
				{"message":{"text":"/start `+currentCode+`","chat":{"id":4242,"type":"private","first_name":"Ak","username":"ak"}}}
			]}`)
		case strings.HasSuffix(r.URL.Path, "/sendMessage"):
			sent = append(sent, in)
			io.WriteString(w, `{"ok":true,"result":{}}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	t.Setenv("TELEGRAM_BOT_TOKEN", "123:abc")
	t.Setenv("TELEGRAM_CHAT_ID", "")
	settings := memSettings{}
	tg := NewTelegram(settings)
	tg.apiBase = srv.URL

	if err := tg.Send(t.Context(), "hi"); err != ErrTelegramNoChat {
		t.Fatalf("Send before connect = %v, want ErrTelegramNoChat", err)
	}
	link, err := tg.StartLink(t.Context())
	if err != nil {
		t.Fatalf("StartLink: %v", err)
	}
	currentCode = settings[settingTelegramCode]
	if !strings.HasPrefix(link, "https://t.me/alto_test_bot?start=") || currentCode == "" {
		t.Fatalf("unexpected link %q", link)
	}
	name, err := tg.Connect(t.Context())
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	if settings[settingTelegramChat] != "4242" || name != "Ak (@ak)" {
		t.Fatalf("connected to %q (%q), want 4242 (Ak (@ak))", settings[settingTelegramChat], name)
	}
	if err := tg.Send(t.Context(), "hello"); err != nil {
		t.Fatalf("Send: %v", err)
	}
	if len(sent) != 2 || sent[1]["chat_id"] != "4242" || sent[1]["parse_mode"] != "HTML" {
		t.Fatalf("unexpected sends: %v", sent)
	}
}

func TestTelegramNotConfigured(t *testing.T) {
	t.Setenv("TELEGRAM_BOT_TOKEN", "")
	tg := NewTelegram(memSettings{})
	if err := tg.Send(t.Context(), "x"); err != ErrTelegramNotConfigured {
		t.Fatalf("got %v, want ErrTelegramNotConfigured", err)
	}
	if st := tg.Status(t.Context()); st.TokenSet || st.Connected {
		t.Fatalf("status = %+v, want unset", st)
	}
}

var currentCode string
