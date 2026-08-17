import IndexedDB from '../database/indexedDB';
import { Message, MessageDisplay } from '../types';

export function getListMessageDisplay(
  msgs: Readonly<Message[]>,
  leafNodeId: Message['id']
): MessageDisplay[] {
  const currNodes = IndexedDB.filterByLeafNodeId(msgs, leafNodeId, true);
  const res: MessageDisplay[] = [];
  const nodeMap = new Map<Message['id'], Message>();
  for (const msg of msgs) {
    nodeMap.set(msg.id, msg);
  }
  // find leaf node from a message node
  const findLeafNode = (msgId: Message['id']): Message['id'] => {
    let currNode: Message | undefined = nodeMap.get(msgId);
    // A message cannot be its own descendant. An import checks ids and
    // conversation ids and nothing else, so a damaged file can say otherwise —
    // and this walk would then spin for ever, freezing the tab with no error.
    const seen = new Set<Message['id']>();
    while (currNode && !seen.has(currNode.id)) {
      seen.add(currNode.id);
      if (currNode.children.length === 0) break;
      const next = nodeMap.get(currNode.children.at(-1) ?? -1);
      if (!next) break;
      currNode = next;
    }
    return currNode?.id ?? -1;
  };
  // traverse the current nodes
  for (const msg of currNodes) {
    const parentNode = nodeMap.get(msg.parent ?? -1);
    if (!parentNode) continue;
    const siblings = parentNode.children;
    if (msg.type !== 'root') {
      res.push({
        msg,
        siblingLeafNodeIds: siblings.map(findLeafNode),
        siblingCurrIdx: siblings.indexOf(msg.id),
      });
    }
  }
  return res;
}
