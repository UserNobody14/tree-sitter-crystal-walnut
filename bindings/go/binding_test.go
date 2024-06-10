package tree_sitter_crystalwalnut_test

import (
	"testing"

	tree_sitter "github.com/smacker/go-tree-sitter"
	"github.com/tree-sitter/tree-sitter-crystalwalnut"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_crystalwalnut.Language())
	if language == nil {
		t.Errorf("Error loading Crystalwalnut grammar")
	}
}
