package logger

import (
	"io"
	"log/slog"
	"os"
)

func Setup(level string) {
	var logLevel slog.Level

	switch level {
	case "debug":
		logLevel = slog.LevelDebug
	case "info":
		logLevel = slog.LevelInfo
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: logLevel,
	}

	var out io.Writer = os.Stdout
	handler := slog.NewJSONHandler(out, opts)
	slog.SetDefault(slog.New(handler))
}
