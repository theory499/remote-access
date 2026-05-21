'use strict';

class FakeNode {
  constructor() {
    this.value = undefined;
    this.children = new Map();
    this.valueListeners = new Set();
    this.childAddedListeners = new Set();
    this.disconnectActions = [];
  }

  exists() {
    if (this.value !== undefined) return true;
    for (const child of this.children.values()) {
      if (child.exists()) return true;
    }
    return false;
  }

  snapshot() {
    const node = this;
    return {
      exists: () => node.exists(),
      val: () => node._materialise()
    };
  }

  _materialise() {
    if (this.children.size === 0) return this.value === undefined ? null : this.value;
    const obj = {};
    for (const [key, child] of this.children) {
      if (child.exists()) obj[key] = child._materialise();
    }
    return Object.keys(obj).length === 0 ? (this.value === undefined ? null : this.value) : obj;
  }
}

class FakeDatabase {
  constructor() {
    this.root = new FakeNode();
    this._pushCounter = 0;
  }

  _parts(path) {
    return path.split('/').filter(Boolean);
  }

  _resolve(parts, createMissing) {
    let node = this.root;
    for (const part of parts) {
      if (!node.children.has(part)) {
        if (!createMissing) return null;
        node.children.set(part, new FakeNode());
      }
      node = node.children.get(part);
    }
    return node;
  }

  ref(path) { return { path: path.replace(/\/+$/, '') }; }

  async set(ref, value) {
    const parts = this._parts(ref.path);
    const writtenAncestors = [];
    let node = this.root;
    let parent = null;
    let childKey = null;
    for (const part of parts) {
      parent = node;
      childKey = part;
      let isNew = !parent.children.has(part);
      if (isNew) parent.children.set(part, new FakeNode());
      node = parent.children.get(part);
      writtenAncestors.push({ parent, key: part, isNew });
    }

    this._writeNode(node, value);

    if (parent && (value !== null && value !== undefined)) {
      const newlyCreated = writtenAncestors[writtenAncestors.length - 1].isNew;
      if (newlyCreated) {
        for (const listener of parent.childAddedListeners) listener(node.snapshot(), childKey);
      }
    }

    this._notifyAncestors(parts);
  }

  async push(ref, value) {
    this._pushCounter += 1;
    const id = `auto_${String(this._pushCounter).padStart(6, '0')}`;
    await this.set(this.ref(`${ref.path}/${id}`), value);
    return { key: id };
  }

  async remove(ref) {
    await this.set(ref, null);
  }

  _writeNode(node, value) {
    if (value === null || value === undefined) {
      node.value = undefined;
      node.children.clear();
      for (const listener of node.valueListeners) listener(node.snapshot());
      return;
    }
    if (typeof value === 'object') {
      node.value = undefined;
      const existingKeys = new Set(node.children.keys());
      for (const [key, sub] of Object.entries(value)) {
        const isNew = !node.children.has(key);
        if (isNew) node.children.set(key, new FakeNode());
        const child = node.children.get(key);
        this._writeNode(child, sub);
        if (isNew) {
          for (const listener of node.childAddedListeners) listener(child.snapshot(), key);
        }
        existingKeys.delete(key);
      }
      for (const key of existingKeys) {
        const child = node.children.get(key);
        this._writeNode(child, null);
      }
    } else {
      node.value = value;
      node.children.clear();
    }
    for (const listener of node.valueListeners) listener(node.snapshot());
  }

  onValue(ref, callback) {
    const node = this._resolve(this._parts(ref.path), true);
    node.valueListeners.add(callback);
    queueMicrotask(() => {
      if (node.valueListeners.has(callback)) callback(node.snapshot());
    });
    return () => node.valueListeners.delete(callback);
  }

  onChildAdded(ref, callback) {
    const node = this._resolve(this._parts(ref.path), true);
    node.childAddedListeners.add(callback);
    queueMicrotask(() => {
      if (!node.childAddedListeners.has(callback)) return;
      for (const [key, child] of node.children) {
        if (child.exists()) callback(child.snapshot(), key);
      }
    });
    return () => node.childAddedListeners.delete(callback);
  }

  onDisconnect(ref) {
    const node = this._resolve(this._parts(ref.path), true);
    return {
      remove: async () => {
        node.disconnectActions.push(() => this._writeNode(node, null));
      }
    };
  }

  async triggerDisconnect() {
    const collect = (node) => {
      for (const action of node.disconnectActions) action();
      node.disconnectActions = [];
      for (const child of node.children.values()) collect(child);
    };
    collect(this.root);
  }

  _notifyAncestors(parts) {
    for (let i = parts.length; i > 0; i -= 1) {
      const ancestor = this._resolve(parts.slice(0, i), true);
      for (const listener of ancestor.valueListeners) listener(ancestor.snapshot());
    }
    for (const listener of this.root.valueListeners) listener(this.root.snapshot());
  }
}

function buildFakeHelpers(database) {
  return {
    set: (ref, value) => database.set(ref, value),
    push: (ref, value) => database.push(ref, value),
    remove: (ref) => database.remove(ref),
    onValue: (ref, cb) => database.onValue(ref, cb),
    onChildAdded: (ref, cb) => database.onChildAdded(ref, cb),
    onDisconnectRemove: (ref) => database.onDisconnect(ref).remove()
  };
}

module.exports = { FakeDatabase, buildFakeHelpers };
