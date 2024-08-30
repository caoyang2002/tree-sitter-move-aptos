import XCTest
import SwiftTreeSitter
import TreeSitterMove

final class TreeSitterMoveTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_move())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Move grammar")
    }
}
