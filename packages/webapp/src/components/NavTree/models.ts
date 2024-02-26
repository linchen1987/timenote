import orderBy from 'lodash/orderBy';

type MenuItem = {
  id: string;
  title: string;
  parentId: string;
  createdAt: Date;
  order?: number;
};

export type MenuList = MenuItem[];

export class MenuTreeNode {
  private _children: MenuTreeNode[] = [];

  public order: number;

  static toDocTree(docTreeList: MenuList = []): MenuTreeNode {
    const root = new MenuTree();
    const list = orderBy(docTreeList, ['createdAt'], ['asc']);
    const listKeyById = list.reduce<{ [id: string]: MenuItem }>(
      (acc, cur) => ({ ...acc, [cur.id]: cur }),
      {}
    );
    const nodeMap = new Map<string, MenuTreeNode>();

    const createNode = (item: MenuItem) => {
      if (nodeMap.has(item.id)) {
        return nodeMap.get(item.id)!;
      }

      const parentItem = listKeyById[item.parentId];
      // item.parentId 所引用的父元素排在 item 之后的情况, 为父元素创建对应的 Node (并存储在 nodeMap 中)
      if (parentItem && !nodeMap.has(item.parentId)) {
        createNode(parentItem);
      }
      const parentNode = nodeMap.get(item.parentId);
      const node = new MenuTreeNode(
        item.id,
        item.title,
        item.createdAt,
        parentNode,
        item.order
      );
      if (parentNode) {
        parentNode.addChild(node);
      }
      nodeMap.set(item.id, node);
      return node;
    };
    // top-level nodes
    (list || [])
      .map(createNode)
      .filter((node) => !node.parent)
      .forEach((node) => {
        root.addChild(node);
        node.parent = root;
      });
    return root;
  }

  constructor(
    public id: string,
    public title: string,
    public createdAt: Date,
    public parent?: MenuTreeNode,
    order?: number
  ) {
    this.order = order ?? createdAt.getTime();
  }

  get children(): MenuTreeNode[] {
    return this._children;
  }

  sortChildren() {
    this._children.sort((a, b) => a.order - b.order);
  }

  moveTo(target: MenuTreeNode, action: 'appendChild' | 'moveAfter' | 'moveBefore') {
    if (action === 'appendChild') {
      const lastChild = target.getLastChild();
      if (lastChild) {
        this.order = lastChild.order || 0 + 100;
      }
      this.remove();
      target.addChild(this);
    } else if (action === 'moveAfter') {
      const next = target.getNextSibling();
      if (next) {
        const order1 = target.order || 0;
        const order2 = next.order || 0;
        this.order = order1 + (order2 - order1) / 2;
      } else {
        this.order = target.order + 100;
      }
      this.remove();
      target.parent!.addChild(this);
    } else if (action === 'moveBefore') {
      const prev = target.getPrevSibling();
      if (prev) {
        const order1 = target.order || 0;
        const order2 = prev.order || 0;
        this.order = order2 + (order1 - order2) / 2;
      } else {
        this.order = target.order / 2;
      }
      this.remove();
      target.parent!.addChild(this);
    }
  }

  getNextSibling() {
    if (this.parent) {
      const idx = this.parent.children.findIndex((x) => x === this);
      return this.parent.children[idx + 1];
    }
    return undefined;
  }

  getPrevSibling() {
    if (this.parent) {
      const idx = this.parent.children.findIndex((x) => x === this);
      return this.parent.children[idx - 1];
    }
    return undefined;
  }

  getLastChild() {
    return this.children[this.children.length - 1];
  }

  addChild(node: MenuTreeNode) {
    this.children.push(node);
    this.sortChildren();
    node.parent = this;
    return this;
  }

  addChildren(children: MenuTreeNode[]) {
    children.forEach((child) => this.addChild(child));
    return this;
  }

  removeChild(node: MenuTreeNode) {
    const index = this.children.indexOf(node);
    this.children.splice(index, 1);
    return this;
  }

  remove() {
    this.parent?.removeChild(this);
  }

  removeNode(id: string) {
    this.findNode(id)?.remove();
  }

  hasChildren() {
    return this.children.length > 0;
  }

  findNode(id: string): MenuTreeNode | undefined {
    if (this.id === id) {
      return this;
    }
    for (let i = 0; i < this._children.length; i++) {
      const found = this._children[i]?.findNode(id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  getParent(ignoreRoot?: boolean) {
    if (ignoreRoot && this.parent instanceof MenuTree) {
      return null;
    }
    return this.parent;
  }

  getAncestors() {
    const parents = [];
    let { parent } = this;
    while (parent) {
      parents.unshift(parent);
      parent = parent.parent;
    }
    return parents;
  }

  getDepth() {
    return this.getAncestors().length;
  }

  clone() {
    const cloned = new MenuTreeNode(
      this.id,
      this.title,
      this.createdAt,
      this.parent,
      this.order
    );

    cloned.addChildren(this.children);
    return cloned;
  }
}

export class MenuTree extends MenuTreeNode {
  constructor() {
    super('root', 'root', new Date());
  }
}
