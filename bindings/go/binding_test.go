package tree_sitter_move_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_move "github.com/tree-sitter/tree-sitter-move/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_move.Language())
	if language == nil {
		t.Errorf("Error loading Move grammar")
	}
}
