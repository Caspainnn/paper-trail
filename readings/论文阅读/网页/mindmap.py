"""Parse the small editable Markdown list format used by field maps."""
import html
import re


def parse_map(source):
    root = None
    stack = []
    for line in source.splitlines():
        if not line.strip():
            continue
        match = re.fullmatch(r'( *)- (.+)', line)
        if not match or len(match[1]) % 2:
            raise ValueError('思维导图须使用两空格缩进的 Markdown 列表')
        level = len(match[1]) // 2
        if level > len(stack) or (root is None and level != 0):
            raise ValueError('思维导图不能跳过层级')
        label = html.escape(match[2])
        node = {'content': re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', label), 'children': []}
        if level == 0:
            if root is not None:
                raise ValueError('思维导图只能有一个根节点')
            root = node
        else:
            stack[level - 1]['children'].append(node)
        stack = stack[:level] + [node]
    if root is None:
        raise ValueError('思维导图不能为空')
    return root
