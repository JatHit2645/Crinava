import ast
import os


def get_indentation(line):
    return len(line) - len(line.lstrip())


def insert_docstrings(filepath):
    """Insert missing docstrings into a Python source file.
    Parameters:
        - filepath (str): Path to the Python file to process.
    Returns:
        - None: The file is updated in place with generated docstrings when missing."""
    print(f"Processing {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    source = "".join(lines)
    try:
        tree = ast.parse(source)
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        return

    # Find nodes that need docstrings
    to_insert = []  # list of tuples: (line_index_to_insert_after, indentation_spaces, docstring_text)

    class DocstringFinder(ast.NodeVisitor):
        """
        Visit an AST and schedule insertion of default docstrings for modules, classes, and functions that are missing them.
        Parameters:
            - node (ast.AST): The AST node being visited and inspected for an existing docstring.
        Processing Logic:
            - Checks only nodes with a non-empty body before scheduling an insertion.
            - Uses the first statement’s line number and indentation to place the docstring correctly.
            - Handles both synchronous and asynchronous function definitions through a shared helper.
            - Appends insertion instructions to external state rather than modifying the AST directly.
        """
        def visit_Module(self, node):
            if not ast.get_docstring(node):
                to_insert.append((0, 0, '"""Module docstring."""\n'))
            self.generic_visit(node)

        def visit_ClassDef(self, node):
            """Insert a class docstring when one is missing.
            Parameters:
                - node (ast.ClassDef): The class definition AST node to inspect and update.
            Returns:
                - None: This function modifies the class node in place by scheduling a docstring insertion."""
            if not ast.get_docstring(node) and node.body:
                first_stmt = node.body[0]
                line_idx = first_stmt.lineno - 1
                indent = get_indentation(lines[line_idx])
                to_insert.append(
                    (line_idx, indent, f'"""Docstring for {node.name} class."""\n')
                )
            self.generic_visit(node)

        def _handle_function(self, node):
            """Insert a default docstring into a function or method node if one is missing.
            Parameters:
                - self (object): The visitor or handler instance containing helper state such as source lines and insertion targets.
                - node (ast.AST): The function or method AST node to inspect and potentially annotate.
            Returns:
                - None: This method updates internal insertion state when a docstring needs to be added."""
            if not ast.get_docstring(node) and node.body:
                first_stmt = node.body[0]
                line_idx = first_stmt.lineno - 1
                indent = get_indentation(lines[line_idx])
                to_insert.append(
                    (line_idx, indent, f'"""Docstring for {node.name}."""\n')
                )
            self.generic_visit(node)

        def visit_FunctionDef(self, node):
            self._handle_function(node)

        def visit_AsyncFunctionDef(self, node):
            self._handle_function(node)

    DocstringFinder().visit(tree)

    # Sort insertions from bottom to top so that line indices don't shift!
    # Also deduplicate by line_idx to avoid double insertion on same line
    seen_indices = set()
    unique_insertions = []
    for line_idx, indent, doc_text in sorted(
        to_insert, key=lambda x: x[0], reverse=True
    ):
        if line_idx not in seen_indices:
            seen_indices.add(line_idx)
            unique_insertions.append((line_idx, indent, doc_text))

    modified = False
    for line_idx, indent, doc_text in unique_insertions:
        indent_str = " " * indent
        formatted_doc = f"{indent_str}{doc_text}"
        if line_idx == 0:
            lines.insert(0, doc_text)
        else:
            lines.insert(line_idx, formatted_doc)
        modified = True

    if modified:
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        print(f"Added docstrings to {filepath}")


def main():
    """Insert generated docstrings into existing Python files in the current project.
    Parameters:
        - None: This function takes no explicit parameters.
    Returns:
        - None: This function does not return a value; it iterates over a list of Python filenames and processes each one that exists by calling insert_docstrings()."""
    python_files = [
        "crinava_worker.py",
        "stealth.py",
        "main.py",
        "worker.py",
        "create_meta_db.py",
        "create_speed_db.py",
        "hf_main.py",
        "engine.py",
        "scratch_probe_hf.py",
        "logger.py",
        "probe_player_map.py",
        "probe_api.py",
        "resolve_crex.py",
        "test_ball_feeds.py",
        "test_cricbuzz.py",
        "test_dns.py",
        "test_mapping_endpoint.py",
    ]
    for filename in filter(os.path.exists, python_files):
        insert_docstrings(filename)


if __name__ == "__main__":
    main()
