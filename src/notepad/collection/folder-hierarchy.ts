import { Observable } from './observable';
import type { StorageAdapter } from '../storage/adapter';
import type { Folder, FolderIcon } from '../types';

export interface FolderHierarchyState {
  folders: Folder[];
}

const EMPTY_STATE: FolderHierarchyState = { folders: [] };

export class FolderHierarchy extends Observable<FolderHierarchyState> {
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter) {
    super(EMPTY_STATE);
    this.adapter = adapter;
  }

  async init(): Promise<void> {
    const folders = await this.adapter.getFolders();
    this.setState((prev) => ({ ...prev, folders }));
  }

  createFolder = async (
    name: string,
    parentId: string | null,
    icon?: FolderIcon,
    color?: string,
  ): Promise<Folder> => {
    const { folders } = this.getSnapshot();
    const order = folders.filter((f) => f.parentId === parentId).length;
    const created = await this.adapter.createFolder({ name, parentId, order, icon, color });
    this.setState((prev) => ({ ...prev, folders: [...prev.folders, created] }));
    return created;
  };

  renameFolder = async (id: string, name: string): Promise<Folder> => {
    const updated = await this.adapter.updateFolder(id, { name });
    this.setState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === id ? updated : f)),
    }));
    return updated;
  };

  deleteFolder = async (id: string): Promise<void> => {
    await this.adapter.deleteFolder(id);
    this.setState((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== id),
    }));
  };

  rebindAdapter(next: StorageAdapter): void {
    this.adapter = next;
    this.setState(() => EMPTY_STATE);
  }
}
