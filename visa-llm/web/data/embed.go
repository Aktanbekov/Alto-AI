// Package data exposes the public corpus datasets to the Go web server.
package data

import _ "embed"

//go:embed questions.json
var QuestionsJSON []byte

//go:embed stats.json
var StatsJSON []byte
