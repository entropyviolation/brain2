/**
 * components/Lists/hooks/useFolderContextMenu.ts
 *
 * Folder right-click menu and the in-place rename that follows it.
 * Rename still refuses a non-editable folder and an empty name.
 */
import { useCallback, useState } from "react"
import { isEditableFolder } from "@/lib/folder-tree"
import type { Folder } from "@/lib/types"
import {
  type FolderContextMenuState,
} from "@/components/Lists/views/FolderContextMenu"

export function useFolderContextMenu({
  folders,
  updateFolder,
}: {
  folders: Folder[]
  updateFolder: (folder: Folder) => void
}) {
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)

  const handleFolderContextMenu = useCallback((folderId: string, clientX: number, clientY: number) => {
    setFolderContextMenu({ folderId, x: clientX, y: clientY })
  }, [])

  const handleCommitFolderRename = useCallback(
    (folderId: string, name: string) => {
      const folder = folders.find((f) => f.id === folderId)
      if (!folder || !isEditableFolder(folderId)) {
        setRenamingFolderId(null)
        return
      }
      const next = name.trim()
      if (next && next !== folder.name) updateFolder({ ...folder, name: next })
      setRenamingFolderId(null)
    },
    [folders, updateFolder],
  )

  const folderRenameProps = {
    onFolderContextMenu: handleFolderContextMenu,
    renamingFolderId,
    onCommitFolderRename: handleCommitFolderRename,
    onCancelFolderRename: () => setRenamingFolderId(null),
  }

  return {
    folderContextMenu,
    setFolderContextMenu,
    renamingFolderId,
    setRenamingFolderId,
    folderRenameProps,
  }
}
