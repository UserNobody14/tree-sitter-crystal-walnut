package tree_sitter_cwal_test

import (
	"testing"

	tree_sitter "github.com/smacker/go-tree-sitter"
	"github.com/tree-sitter/tree-sitter-cwal"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_cwal.Language())
	if language == nil {
		t.Errorf("Error loading Cwal grammar")
	}
}
