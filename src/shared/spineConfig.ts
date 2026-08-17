import { spineAssetsConfig } from "../generated/spineAssetsConfig";
import type {
  SpineAnimationGroup,
  SpineSkeletonConfig,
} from "../types";

export { spineAssetsConfig };

export function getAnimationGroup(groupId: number): SpineAnimationGroup {
  const group = spineAssetsConfig.animationGroups.find(
    (item) => item.id === groupId,
  );
  if (!group) {
    throw new Error(`Unknown animation group: ${groupId}`);
  }
  return group;
}

export function getSkeletonById(skeletonId: string): SpineSkeletonConfig {
  const skeleton = spineAssetsConfig.skeletons.find(
    (item) => item.id === skeletonId,
  );
  if (!skeleton) {
    throw new Error(`Unknown skeleton: ${skeletonId}`);
  }
  return skeleton;
}

export function getSkeletonsForGroup(
  groupId: number,
): Array<{ skeleton: SpineSkeletonConfig; animationName: string }> {
  return getAnimationGroup(groupId).entries.map((entry) => ({
    skeleton: getSkeletonById(entry.skeletonId),
    animationName: entry.animationName,
  }));
}

export function formatAnimationGroupLabel(group: SpineAnimationGroup): string {
  const ordinal = group.id;
  return `Группа ${ordinal} — ${ordinal}-е анимации (${group.entries.length})`;
}
