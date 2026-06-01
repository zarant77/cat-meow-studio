import type { AssetId, AssetKind } from "../model/assets.js";
import { getProjectAssetSummary, getSelectedProjectAssetId } from "./projectState.js";

export interface AssetExplorerItem {
  id: AssetId;
  kind: AssetKind;
  name: string;
  createdAt: string;
  updatedAt: string;
  isSelected: boolean;
}

export function getAssetExplorerItems(): AssetExplorerItem[] {
  return getProjectAssetSummary().map((asset) => ({
    ...asset,
    isSelected: getSelectedProjectAssetId(asset.kind) === asset.id,
  }));
}

export function getAssetExplorerItemsByKind(kind: AssetKind): AssetExplorerItem[] {
  return getAssetExplorerItems().filter((asset) => asset.kind === kind);
}
