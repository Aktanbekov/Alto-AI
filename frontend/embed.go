// Package frontend embeds the production Vite bundle in the Go server.
package frontend

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var files embed.FS

// DistFS returns the contents of frontend/dist rooted at the web directory.
func DistFS() (fs.FS, error) {
	return fs.Sub(files, "dist")
}
