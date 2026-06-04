import { Copy, Pause, Play, Plus, Square, Trash2, Upload } from "lucide";
import { evaluateAnimation } from "../animation/animationEvaluate.js";
import { exportAnimationJson } from "../animation/animationJson.js";
import { animationPresets } from "../animation/animationPresets.js";
import type { AnimationClip, AnimationEasing, AnimationFile, AnimationImpact, AnimationKey, AnimationProperty, AnimationTrack } from "../animation/animationTypes.js";
import { defaultAnimationImpact } from "../animation/animationTypes.js";
import { importSpriteJson } from "../import/importSpriteJson.js";
import type { SpriteAssetData } from "../model/assets.js";
import { flattenNodes } from "../sprites/document/CatPaintDocument.js";
import { drawPrimitive } from "../sprites/primitives/drawPrimitive.js";
import { downloadFile } from "../utils/downloadFile.js";
import { readTextFile } from "../utils/readTextFile.js";
import { isValidSoundId } from "../utils/symbolName.js";
import type { ModeSurface } from "./appTypes.js";
import { renderAnimatorInspector } from "./animatorInspector.js";
import { renderAnimatorTimeline } from "./animatorTimeline.js";
import { createElement, createIconButton, createTextElement } from "./dom.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

interface AnimatorMount {
  assetPanel: HTMLElement;
  editorArea: HTMLElement;
  inspectorPanel: HTMLElement;
  previewStatusArea: HTMLElement;
  previewCanvas: HTMLCanvasElement;
  previewWrap: HTMLElement;
  toolbarControls: HTMLElement;
  timeRange: HTMLInputElement;
  timeReadout: HTMLElement;
  localStatus: HTMLElement;
  spriteInput: HTMLInputElement;
}

let animatorController: AnimatorController | null = null;

export function renderAnimatorSurface(): ModeSurface {
  const mount = createAnimatorMount();
  getAnimatorController().bind(mount);

  return {
    assetPanel: mount.assetPanel,
    editorArea: mount.editorArea,
    inspectorPanel: mount.inspectorPanel,
    previewStatusArea: mount.previewStatusArea,
  };
}

export function destroyAnimatorWorkspace(): void {
  getAnimatorController().unbind();
}

export function replaceAnimatorAnimation(animationFile: AnimationFile): void {
  getAnimatorController().replaceAnimationFile(animationFile);
}

export function exportCurrentAnimatorJson(): boolean {
  return getAnimatorController().exportAnimation();
}

export function getCurrentAnimatorJson(): string {
  return getAnimatorController().getAnimationJson();
}

export function toggleAnimatorPlayback(): void {
  getAnimatorController().togglePlayback();
}

export function stopAnimatorPlayback(): void {
  getAnimatorController().stopPlayback();
}

function createAnimatorMount(): AnimatorMount {
  const assetPanel = renderAssetSidebarPanel("animator-asset-panel toolbar");
  const editorArea = renderEditorArea("animator-editor-area");
  const inspectorPanel = renderInspectorPanel("animator-inspector-panel");
  const previewStatusArea = renderPreviewStatusArea("Animator workspace status");

  const previewWrap = createElement("section", "animator-preview-wrap");
  const previewCanvas = createElement("canvas", "animator-preview-canvas");
  previewWrap.append(previewCanvas);

  const transport = createElement("section", "animator-transport");
  const timeRange = createElement("input");
  timeRange.type = "range";
  timeRange.min = "0";
  timeRange.max = "0";
  timeRange.step = "1";
  timeRange.value = "0";
  const timeReadout = createTextElement("strong", "0 / 0 ms");
  transport.append(timeRange, timeReadout);

  editorArea.append(previewWrap, transport);

  const localStatus = createTextElement("strong", "No preview sprite imported");
  previewStatusArea.append(createTextElement("span", "Animator"), localStatus);

  const spriteInput = createFileInput(".json,application/json");
  const toolbarControls = createElement("div", "animator-toolbar-controls");
  assetPanel.append(spriteInput, toolbarControls);

  return {
    assetPanel,
    editorArea,
    inspectorPanel,
    previewStatusArea,
    previewCanvas,
    previewWrap,
    toolbarControls,
    timeRange,
    timeReadout,
    localStatus,
    spriteInput,
  };
}

function createFileInput(accept: string): HTMLInputElement {
  const input = createElement("input");
  input.type = "file";
  input.accept = accept;
  input.style.display = "none";

  return input;
}

class AnimatorController {
  private mount: AnimatorMount | null = null;
  private previewSprite: SpriteAssetData | null = null;
  private animationFile: AnimationFile = createEmptyAnimationFile("animation");
  private selectedTrackIndex: number | null = null;
  private selectedKeyIndex: number | null = null;
  private currentTimeMs = 0;
  private playing = false;
  private animationFrameId: number | null = null;
  private lastFrameTimeMs: number | null = null;
  private localStatusMessage = "No preview sprite imported";

  bind(mount: AnimatorMount): void {
    this.unbind();
    this.mount = mount;
    this.bindToolbar(mount);
    this.bindInputs(mount);
    this.render();
    this.scheduleFrame();
  }

  unbind(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.mount = null;
    this.lastFrameTimeMs = null;
  }

  replaceSprite(sprite: SpriteAssetData): void {
    this.previewSprite = sprite;
    this.selectedTrackIndex = this.getSelectedTrack() === null ? null : this.selectedTrackIndex;
    this.selectedKeyIndex = this.getSelectedKey() === null ? null : this.selectedKeyIndex;
    this.currentTimeMs = 0;
    this.playing = false;
    this.setLocalStatus(`Imported ${sprite.spriteId}.sprite.json`);
    this.render();
  }

  replaceAnimationFile(animationFile: AnimationFile): void {
    this.animationFile = cloneAnimationFile(animationFile);
    this.selectedTrackIndex = null;
    this.selectedKeyIndex = null;
    this.currentTimeMs = 0;
    this.playing = false;
    this.setLocalStatus(`Imported ${animationFile.id}.anim.json`);
    this.render();
  }

  exportAnimation(): boolean {
    if (!isValidSoundId(this.animationFile.id)) {
      this.setLocalStatus("Animation ID must use lowercase letters, numbers, underscores, or hyphens.");
      this.render();
      return false;
    }

    if (hasDuplicateTrackProperties(this.animationFile.tracks)) {
      this.setLocalStatus("Animation cannot export duplicate tracks for the same property.");
      this.render();
      return false;
    }

    const animationFile = cloneAnimationFile(this.animationFile);
    downloadFile(`${animationFile.id}.anim.json`, exportAnimationJson(animationFile), "application/json;charset=utf-8");
    this.setLocalStatus(`Exported ${animationFile.id}.anim.json`);
    this.render();

    return true;
  }

  getAnimationJson(): string {
    return exportAnimationJson(this.animationFile);
  }

  togglePlayback(): void {
    if (this.playing) {
      this.pausePlayback();
      return;
    }

    this.playing = true;
    this.lastFrameTimeMs = null;
    this.scheduleFrame();
    this.render();
  }

  stopPlayback(): void {
    this.playing = false;
    this.lastFrameTimeMs = null;
    this.currentTimeMs = 0;
    this.render();
  }

  private pausePlayback(): void {
    this.playing = false;
    this.lastFrameTimeMs = null;
    this.render();
  }

  private bindToolbar(mount: AnimatorMount): void {
    const importSpriteButton = createIconButton(Upload, "Import sprite JSON", "sprite-button");
    const createButton = createIconButton(Plus, "Create animation", "sprite-button");
    const duplicateButton = createIconButton(Copy, "Duplicate animation", "sprite-button");
    const deleteButton = createIconButton(Trash2, "Delete animation", "sprite-button danger");
    const playButton = createIconButton(this.playing ? Pause : Play, `${this.playing ? "Pause" : "Play"} (Space)`, "sprite-button");
    const stopButton = createIconButton(Square, "Stop", "sprite-button");

    importSpriteButton.addEventListener("click", () => mount.spriteInput.click());
    createButton.addEventListener("click", () => this.createAnimation());
    duplicateButton.addEventListener("click", () => this.duplicateAnimation());
    deleteButton.addEventListener("click", () => this.deleteAnimation());
    playButton.addEventListener("click", () => this.togglePlayback());
    stopButton.addEventListener("click", () => this.stopPlayback());

    mount.toolbarControls.replaceChildren(
      importSpriteButton,
      createButton,
      duplicateButton,
      deleteButton,
      playButton,
      stopButton,
    );
  }

  private bindInputs(mount: AnimatorMount): void {
    mount.spriteInput.addEventListener("change", () => {
      void this.importSpriteFromInput(mount.spriteInput);
    });
    mount.timeRange.addEventListener("input", () => {
      this.currentTimeMs = Number.parseInt(mount.timeRange.value, 10) || 0;
      this.playing = false;
      this.drawPreview();
      this.syncTransport();
    });
  }

  private async importSpriteFromInput(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0] ?? null;
    input.value = "";

    if (file === null) {
      return;
    }

    const text = await readTextFile(file);
    const result = importSpriteJson(text);

    if (!result.ok) {
      this.setLocalStatus(result.error);
      this.render();
      return;
    }

    this.replaceSprite(result.sprite);
  }

  private render(): void {
    const mount = this.mount;

    if (mount === null) {
      return;
    }

    this.bindToolbar(mount);
    mount.inspectorPanel.replaceChildren(
      renderAnimatorInspector({
        previewSpriteId: this.previewSprite?.spriteId ?? null,
        clip: this.animationFile,
        selectedClip: this.getSelectedClip(),
        selection: {
          track: this.getSelectedTrack(),
          key: this.getSelectedKey(),
        },
        presetOptions: animationPresets.map((preset) => ({ id: preset.id, label: preset.label })),
        actions: {
          selectClip: (clipId) => this.selectClip(clipId),
          updateClip: (patch) => this.updateSelectedClip(patch),
          updateSelectedTrack: (property) => this.updateSelectedTrack(property),
          updateSelectedKey: (patch) => this.updateSelectedKey(patch),
          applyPreset: (presetId) => this.applyPreset(presetId),
        },
      }),
    );

    const timeline = renderAnimatorTimeline(this.getSelectedClip(), {
      trackIndex: this.selectedTrackIndex,
      keyIndex: this.selectedKeyIndex,
    }, {
      addTrack: () => this.addTrack(),
      deleteTrack: (trackIndex) => this.deleteTrack(trackIndex),
      updateTrackProperty: (trackIndex, property) => this.updateTrackProperty(trackIndex, property),
      addKey: (trackIndex) => this.addKey(trackIndex),
      deleteKey: (trackIndex, keyIndex) => this.deleteKey(trackIndex, keyIndex),
      selectKey: (trackIndex, keyIndex) => this.selectKey(trackIndex, keyIndex),
      updateKey: (trackIndex, keyIndex, patch) => this.updateKey(trackIndex, keyIndex, patch),
    });

    const existingTimeline = mount.editorArea.querySelector(".animator-timeline");

    if (existingTimeline === null) {
      mount.editorArea.append(timeline);
    } else {
      existingTimeline.replaceWith(timeline);
    }

    mount.localStatus.textContent = this.localStatusMessage;
    this.syncTransport();
    this.drawPreview();
  }

  private syncTransport(): void {
    const mount = this.mount;
    const selectedClip = this.getSelectedClip();
    const durationMs = selectedClip?.durationMs ?? 0;

    if (mount === null) {
      return;
    }

    if (this.currentTimeMs > durationMs) {
      this.currentTimeMs = durationMs;
    }

    mount.timeRange.max = String(Math.max(0, durationMs));
    mount.timeRange.value = String(this.currentTimeMs);
    mount.timeReadout.textContent = `${this.currentTimeMs} / ${durationMs} ms`;
  }

  private drawPreview(): void {
    const mount = this.mount;

    if (mount === null) {
      return;
    }

    const canvas = mount.previewCanvas;
    const rect = mount.previewWrap.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");

    if (ctx === null) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawPreviewBackground(ctx, width, height);

    const selectedClip = this.getSelectedClip();
    const impact = selectedClip === null ? defaultAnimationImpact : evaluateAnimation(selectedClip, this.currentTimeMs);

    if (this.previewSprite === null) {
      drawFallbackSprite(ctx, impact, width, height);
      return;
    }

    drawSprite(ctx, this.previewSprite, impact, width, height);
  }

  private scheduleFrame(): void {
    if (!this.playing || this.animationFrameId !== null) {
      return;
    }

    this.animationFrameId = window.requestAnimationFrame((timeMs) => this.tick(timeMs));
  }

  private tick(frameTimeMs: number): void {
    this.animationFrameId = null;

    if (!this.playing) {
      return;
    }

    const selectedClip = this.getSelectedClip();

    if (selectedClip === null) {
      this.playing = false;
      this.render();
      return;
    }

    const deltaMs = this.lastFrameTimeMs === null ? 0 : frameTimeMs - this.lastFrameTimeMs;
    this.lastFrameTimeMs = frameTimeMs;
    this.currentTimeMs += Math.max(0, Math.round(deltaMs));

    if (selectedClip.loop && selectedClip.durationMs > 0) {
      this.currentTimeMs %= selectedClip.durationMs;
    } else if (this.currentTimeMs >= selectedClip.durationMs) {
      this.currentTimeMs = selectedClip.durationMs;
      this.playing = false;
      this.render();
      return;
    }

    this.syncTransport();
    this.drawPreview();
    this.scheduleFrame();
  }

  private createAnimation(): void {
    const clip: AnimationClip = {
      version: 1,
      id: "animation",
      durationMs: 600,
      loop: true,
      tracks: [],
    };
    this.animationFile = clip;
    this.selectedTrackIndex = null;
    this.selectedKeyIndex = null;
    this.currentTimeMs = 0;
    this.setLocalStatus(`Created ${clip.id}`);
    this.render();
  }

  private duplicateAnimation(): void {
    const selectedClip = this.getSelectedClip();

    if (selectedClip === null) {
      return;
    }

    const clip = cloneClip(selectedClip);
    clip.id = createDuplicateClipId(selectedClip.id);
    this.animationFile = clip;
    this.setLocalStatus(`Duplicated ${selectedClip.id}`);
    this.render();
  }

  private deleteAnimation(): void {
    const selectedClip = this.getSelectedClip();

    if (selectedClip === null || !window.confirm(`Delete animation "${selectedClip.id}"?`)) {
      return;
    }

    this.animationFile = createEmptyAnimationFile("animation");
    this.selectedTrackIndex = null;
    this.selectedKeyIndex = null;
    this.currentTimeMs = 0;
    this.setLocalStatus(`Deleted ${selectedClip.id}`);
    this.render();
  }

  private applyPreset(presetId: string): void {
    const preset = animationPresets.find((candidate) => candidate.id === presetId);

    if (preset === undefined) {
      return;
    }

    const clip = preset.createClip(preset.id);
    this.animationFile = clip;
    this.selectedTrackIndex = 0;
    this.selectedKeyIndex = 0;
    this.currentTimeMs = 0;
    this.setLocalStatus(`Created ${preset.label}`);
    this.render();
  }

  private selectClip(clipId: string): void {
    this.animationFile.id = clipId;
    this.selectedTrackIndex = null;
    this.selectedKeyIndex = null;
    this.currentTimeMs = 0;
    this.render();
  }

  private updateSelectedClip(patch: Partial<Pick<AnimationClip, "id" | "durationMs" | "loop">>): void {
    const selectedClip = this.getSelectedClip();

    if (selectedClip === null) {
      return;
    }

    if (patch.id !== undefined) {
      selectedClip.id = patch.id;
    }

    if (patch.durationMs !== undefined) {
      selectedClip.durationMs = Math.max(1, Math.round(patch.durationMs));
      this.currentTimeMs = Math.min(this.currentTimeMs, selectedClip.durationMs);
    }

    if (patch.loop !== undefined) {
      selectedClip.loop = patch.loop;
    }

    this.render();
  }

  private addTrack(): void {
    const selectedClip = this.getSelectedClip();

    if (selectedClip === null) {
      return;
    }

    const property = animationPropertiesFirstUnused(selectedClip.tracks);

    if (selectedClip.tracks.some((track) => track.property === property)) {
      this.setLocalStatus("Every supported animation property already has a track.");
      this.render();
      return;
    }

    selectedClip.tracks.push({ property, keys: [] });
    this.selectedTrackIndex = selectedClip.tracks.length - 1;
    this.selectedKeyIndex = null;
    this.render();
  }

  private deleteTrack(trackIndex: number): void {
    const selectedClip = this.getSelectedClip();

    if (selectedClip === null || selectedClip.tracks[trackIndex] === undefined) {
      return;
    }

    selectedClip.tracks.splice(trackIndex, 1);
    this.selectedTrackIndex = null;
    this.selectedKeyIndex = null;
    this.render();
  }

  private updateTrackProperty(trackIndex: number, property: AnimationProperty): void {
    const track = this.getTrack(trackIndex);
    const selectedClip = this.getSelectedClip();

    if (track === null || selectedClip === null) {
      return;
    }

    if (selectedClip.tracks.some((candidate, index) => index !== trackIndex && candidate.property === property)) {
      this.setLocalStatus(`Animation already has a "${property}" track.`);
      this.render();
      return;
    }

    track.property = property;
    track.keys.forEach((key) => {
      key.value = clampPropertyValue(property, key.value);
    });
    this.selectedTrackIndex = trackIndex;
    this.render();
  }

  private updateSelectedTrack(property: AnimationProperty): void {
    if (this.selectedTrackIndex === null) {
      return;
    }

    this.updateTrackProperty(this.selectedTrackIndex, property);
  }

  private addKey(trackIndex: number): void {
    const track = this.getTrack(trackIndex);

    if (track === null) {
      return;
    }

    const key: AnimationKey = {
      timeMs: this.currentTimeMs,
      value: clampPropertyValue(track.property, getDefaultPropertyValue(track.property)),
      easing: "linear",
    };
    track.keys.push(key);
    this.selectedTrackIndex = trackIndex;
    this.selectedKeyIndex = sortTrackKeys(track, key);
    this.render();
  }

  private deleteKey(trackIndex: number, keyIndex: number): void {
    const track = this.getTrack(trackIndex);

    if (track === null || track.keys[keyIndex] === undefined) {
      return;
    }

    track.keys.splice(keyIndex, 1);
    this.selectedTrackIndex = trackIndex;
    this.selectedKeyIndex = track.keys.length === 0 ? null : Math.min(keyIndex, track.keys.length - 1);
    this.render();
  }

  private selectKey(trackIndex: number, keyIndex: number): void {
    this.selectedTrackIndex = trackIndex;
    this.selectedKeyIndex = keyIndex;
    this.render();
  }

  private updateKey(
    trackIndex: number,
    keyIndex: number,
    patch: Partial<{ timeMs: number; value: number; easing: AnimationEasing }>,
  ): void {
    const track = this.getTrack(trackIndex);
    const key = track?.keys[keyIndex] ?? null;

    if (track === null || key === null) {
      return;
    }

    if (patch.timeMs !== undefined) {
      const selectedClip = this.getSelectedClip();
      key.timeMs = Math.max(0, Math.min(selectedClip?.durationMs ?? 0, Math.round(patch.timeMs)));
    }

    if (patch.value !== undefined) {
      key.value = clampPropertyValue(track.property, patch.value);
    }

    if (patch.easing !== undefined) {
      key.easing = patch.easing;
    }

    this.selectedTrackIndex = trackIndex;
    this.selectedKeyIndex = sortTrackKeys(track, key);
    this.render();
  }

  private updateSelectedKey(patch: Partial<{ timeMs: number; value: number; easing: AnimationEasing }>): void {
    if (this.selectedTrackIndex === null || this.selectedKeyIndex === null) {
      return;
    }

    this.updateKey(this.selectedTrackIndex, this.selectedKeyIndex, patch);
  }

  private getSelectedClip(): AnimationClip | null {
    return this.animationFile;
  }

  private getTrack(trackIndex: number): AnimationTrack | null {
    const selectedClip = this.getSelectedClip();

    if (selectedClip === null) {
      return null;
    }

    return selectedClip.tracks[trackIndex] ?? null;
  }

  private getSelectedTrack(): AnimationTrack | null {
    if (this.selectedTrackIndex === null) {
      return null;
    }

    return this.getTrack(this.selectedTrackIndex);
  }

  private getSelectedKey(): AnimationKey | null {
    const track = this.getSelectedTrack();

    if (track === null || this.selectedKeyIndex === null) {
      return null;
    }

    return track.keys[this.selectedKeyIndex] ?? null;
  }

  private setLocalStatus(message: string): void {
    this.localStatusMessage = message;
  }
}

function drawPreviewBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = "rgb(10 9 7 / 0.78)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgb(255 255 255 / 0.07)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawFallbackSprite(ctx: CanvasRenderingContext2D, impact: AnimationImpact, width: number, height: number): void {
  const pivotX = width / 2;
  const pivotY = height / 2;
  const rectWidth = 96;
  const rectHeight = 128;
  const scale = Math.min(1, Math.max(0.55, Math.min((width - 72) / rectWidth, (height - 72) / rectHeight)));

  ctx.save();
  ctx.strokeStyle = "rgb(255 199 28 / 0.42)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, pivotY + (rectHeight / 2) * scale);
  ctx.lineTo(width - 20, pivotY + (rectHeight / 2) * scale);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, impact.alpha / 255));
  ctx.translate(pivotX + impact.offsetX * scale, pivotY + impact.offsetY * scale);
  ctx.rotate(impact.rotation / 1000);
  ctx.scale((scale * impact.scaleX) / 1000, (scale * impact.scaleY) / 1000);
  ctx.fillStyle = "rgb(255 199 28 / 0.72)";
  ctx.strokeStyle = "rgb(239 223 185 / 0.86)";
  ctx.lineWidth = 3;
  ctx.fillRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
  ctx.strokeRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgb(255 92 92 / 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX - 8, pivotY);
  ctx.lineTo(pivotX + 8, pivotY);
  ctx.moveTo(pivotX, pivotY - 8);
  ctx.lineTo(pivotX, pivotY + 8);
  ctx.stroke();
  ctx.restore();
}

function drawSprite(ctx: CanvasRenderingContext2D, sprite: SpriteAssetData, impact: AnimationImpact, width: number, height: number): void {
  const fitScale = Math.min((width - 56) / sprite.width, (height - 56) / sprite.height);
  const scale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
  const pivotX = width / 2;
  const pivotY = height / 2;

  ctx.save();
  ctx.strokeStyle = "rgb(255 199 28 / 0.42)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, pivotY + (sprite.height - sprite.pivotY) * scale);
  ctx.lineTo(width - 20, pivotY + (sprite.height - sprite.pivotY) * scale);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, impact.alpha / 255));
  ctx.translate(pivotX + impact.offsetX * scale, pivotY + impact.offsetY * scale);
  ctx.rotate(impact.rotation / 1000);
  ctx.scale((scale * impact.scaleX) / 1000, (scale * impact.scaleY) / 1000);
  ctx.translate(-sprite.pivotX, -sprite.pivotY);
  flattenNodes(sprite.nodes).forEach((primitive) => drawPrimitive(ctx, primitive));
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgb(255 92 92 / 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX - 8, pivotY);
  ctx.lineTo(pivotX + 8, pivotY);
  ctx.moveTo(pivotX, pivotY - 8);
  ctx.lineTo(pivotX, pivotY + 8);
  ctx.stroke();
  ctx.restore();
}

function createEmptyAnimationFile(id: string): AnimationFile {
  return {
    version: 1,
    id,
    durationMs: 600,
    loop: true,
    tracks: [],
  };
}

function cloneAnimationFile(animationFile: AnimationFile): AnimationFile {
  return {
    version: 1,
    id: animationFile.id,
    durationMs: animationFile.durationMs,
    loop: animationFile.loop,
    tracks: animationFile.tracks.map((track) => ({
      property: track.property,
      keys: track.keys.map((key) => ({ ...key })),
    })),
  };
}

function cloneClip(clip: AnimationClip): AnimationClip {
  return {
    version: 1,
    id: clip.id,
    durationMs: clip.durationMs,
    loop: clip.loop,
    tracks: clip.tracks.map((track) => ({
      property: track.property,
      keys: track.keys.map((key) => ({ ...key })),
    })),
  };
}

function createDuplicateClipId(clipId: string): string {
  return `${clipId}_copy`;
}

function animationPropertiesFirstUnused(tracks: readonly AnimationTrack[]): AnimationProperty {
  const usedProperties = new Set(tracks.map((track) => track.property));
  const properties: readonly AnimationProperty[] = ["offset_x", "offset_y", "scale_x", "scale_y", "rotation", "alpha"];

  return properties.find((property) => !usedProperties.has(property)) ?? "offset_x";
}

function getDefaultPropertyValue(property: AnimationProperty): number {
  if (property === "scale_x") {
    return defaultAnimationImpact.scaleX;
  }

  if (property === "scale_y") {
    return defaultAnimationImpact.scaleY;
  }

  if (property === "alpha") {
    return defaultAnimationImpact.alpha;
  }

  return 0;
}

function clampPropertyValue(property: AnimationProperty, value: number): number {
  const rounded = Math.round(value);

  if (property === "rotation") {
    return Math.max(-32768, Math.min(32767, rounded));
  }

  if (property === "alpha") {
    return Math.max(0, Math.min(255, rounded));
  }

  return rounded;
}

function sortTrackKeys(track: AnimationTrack, selectedKey: AnimationKey): number {
  track.keys.sort((left, right) => left.timeMs - right.timeMs);

  return Math.max(0, track.keys.indexOf(selectedKey));
}

function hasDuplicateTrackProperties(tracks: readonly AnimationTrack[]): boolean {
  const properties = new Set<AnimationProperty>();

  for (const track of tracks) {
    if (properties.has(track.property)) {
      return true;
    }

    properties.add(track.property);
  }

  return false;
}

function getAnimatorController(): AnimatorController {
  animatorController ??= new AnimatorController();

  return animatorController;
}
