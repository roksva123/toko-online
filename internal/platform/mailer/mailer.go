package mailer

import (
	"context"
)

// Email mewakili satu pesan email
type Email struct {
	To      string
	Subject string
	Body    string
	HTML    bool
}

// Mailer interface mendefinisikan operasi mengirim email
type Mailer interface {
	// Send mengirim email
	Send(ctx context.Context, email *Email) error

	// SendBatch mengirim banyak email
	SendBatch(ctx context.Context, emails []*Email) error
}

// LogMailer adalah implementasi mailer yang hanya mencatat ke log (untuk development)
type LogMailer struct{}

func (m *LogMailer) Send(ctx context.Context, email *Email) error {
	// In development, just log the email
	// slog.Info("email sent", slog.String("to", email.To), slog.String("subject", email.Subject))
	return nil
}

func (m *LogMailer) SendBatch(ctx context.Context, emails []*Email) error {
	for _, email := range emails {
		if err := m.Send(ctx, email); err != nil {
			return err
		}
	}
	return nil
}

// NoopMailer adalah implementasi mailer yang tidak melakukan apa-apa (untuk testing)
type NoopMailer struct{}

func (m *NoopMailer) Send(ctx context.Context, email *Email) error {
	return nil
}

func (m *NoopMailer) SendBatch(ctx context.Context, emails []*Email) error {
	return nil
}
