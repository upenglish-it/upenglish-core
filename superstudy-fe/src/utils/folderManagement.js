export function toggleIdInList(ids = [], targetId) {
    const nextIds = new Set(ids);
    if (nextIds.has(targetId)) {
        nextIds.delete(targetId);
    } else {
        nextIds.add(targetId);
    }
    return Array.from(nextIds);
}

export function findFolderIdForItem(folders = [], itemId, itemIdsKey) {
    if (!itemId) return '';
    return folders.find(folder => (folder[itemIdsKey] || []).includes(itemId))?.id || '';
}

export async function syncItemFolderAssignment({
    itemId,
    targetFolderId = '',
    folders = [],
    itemIdsKey,
    saveFolder
}) {
    if (!itemId || !itemIdsKey || typeof saveFolder !== 'function') return;

    const containingFolders = folders.filter(folder => (folder[itemIdsKey] || []).includes(itemId));
    const writes = [];

    containingFolders.forEach(folder => {
        if (folder.id === targetFolderId) return;
        writes.push(saveFolder({
            ...folder,
            [itemIdsKey]: (folder[itemIdsKey] || []).filter(id => id !== itemId)
        }));
    });

    if (targetFolderId) {
        const targetFolder = folders.find(folder => folder.id === targetFolderId);
        if (targetFolder && !(targetFolder[itemIdsKey] || []).includes(itemId)) {
            writes.push(saveFolder({
                ...targetFolder,
                [itemIdsKey]: [...(targetFolder[itemIdsKey] || []), itemId]
            }));
        }
    }

    await Promise.all(writes);
}

export function reorderList(items = [], sourceIndex, destinationIndex) {
    const nextItems = Array.from(items);
    const [movedItem] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(destinationIndex, 0, movedItem);
    return nextItems;
}

export function reorderIdsByVisibleSubset({
    allIds = [],
    sourceIndex,
    destinationIndex,
    getItem,
    searchTerm = '',
    matchesSearch
}) {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const visibleIds = allIds.filter(id => {
        const item = getItem?.(id);
        if (!item) return false;
        if (!normalizedSearch) return true;
        return matchesSearch ? matchesSearch(item, normalizedSearch) : true;
    });

    if (
        sourceIndex < 0 ||
        destinationIndex < 0 ||
        sourceIndex >= visibleIds.length ||
        destinationIndex >= visibleIds.length
    ) {
        return allIds;
    }

    const reorderedVisibleIds = reorderList(visibleIds, sourceIndex, destinationIndex);
    const visibleIdSet = new Set(visibleIds);
    const nextIds = [];
    let visibleIndex = 0;

    allIds.forEach(id => {
        if (visibleIdSet.has(id)) {
            nextIds.push(reorderedVisibleIds[visibleIndex]);
            visibleIndex += 1;
        } else {
            nextIds.push(id);
        }
    });

    return nextIds;
}
