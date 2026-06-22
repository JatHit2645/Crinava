import ast
import os


def get_indentation(line):
    return len(line) - len(line.lstrip())


def insert_docstrings(filepath):
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
        def visit_Module(self, node):
            if not ast.get_docstring(node):
                to_insert.append((0, 0, '"""Module docstring."""\n'))
            self.generic_visit(node)

        def visit_ClassDef(self, node):
            if not ast.get_docstring(node) and node.body:
                first_stmt = node.body[0]
                line_idx = first_stmt.lineno - 1
                indent = get_indentation(lines[line_idx])
                to_insert.append(
                    (line_idx, indent, f'"""Docstring for {node.name} class."""\n')
                )
            self.generic_visit(node)

        def _handle_function(self, node):
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
    for filename in python_files:
        if os.path.exists(filename):
            insert_docstrings(filename)


if __name__ == "__main__":
    main()
