package migrate

import (
	"context"
	"database/sql"
	"fmt"

	"gamedivers.de/api/db/migrations"
)

func Run(ctx context.Context, db *sql.DB) error {
	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}

		b, err := migrations.FS.ReadFile(e.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", e.Name(), err)
		}

		if _, err := db.ExecContext(ctx, string(b)); err != nil {
			return fmt.Errorf("exec migration %s: %w", e.Name(), err)
		}
	}

	return nil
}
