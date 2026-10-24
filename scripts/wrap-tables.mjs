/**
 * 把 markdown 表格包一层可横向滚动的容器。
 *
 * 手册里有多张三列以上的宽表，窄屏下不包一层会直接撑破正文布局。
 * 用 hast 插件而不是 CSS：CSS 没法只包表格而保持表格自身的表格布局。
 *
 * 这是 Sätteri（{@link https://docs.astro.build/zh/reference/markdown-content/ Astro v7 默认 Markdown 处理器}）
 * 的 hast 插件形状：element.filter 选标签，visit 里用 ctx 改树。
 */

export function wrapTablesPlugin() {
  return {
    name: 'heron-wrap-tables',
    element: {
      filter: ['table'],
      visit(node, ctx) {
        const parent = ctx.parent(node);
        if (!parent) return;

        // 已经被包过就别再包一层
        const parentClass = parent.properties?.className;
        const alreadyWrapped =
          parent.type === 'element' &&
          parent.tagName === 'div' &&
          Array.isArray(parentClass) &&
          parentClass.includes('table-scroll');
        if (alreadyWrapped) return;

        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-scroll'] },
          children: [],
        });
      },
    },
  };
}
