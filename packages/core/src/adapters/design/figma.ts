import axios from 'axios';
import { DesignAsset, ScreenConfig } from '../../types';

const FIGMA_API = 'https://api.figma.com/v1';

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
}

export async function fetchFigmaScreen(
  config: ScreenConfig,
  token: string
): Promise<DesignAsset> {
  if (!config.figmaFileId || !config.figmaNodeId) {
    throw new Error(`[Figma] figmaFileId and figmaNodeId are required for screen "${config.name}"`);
  }

  const fileId = config.figmaFileId;
  const nodeId = config.figmaNodeId;

  // 1. Get node metadata
  const metaRes = await axios.get(`${FIGMA_API}/files/${fileId}/nodes`, {
    headers: { 'X-Figma-Token': token },
    params: { ids: nodeId },
  });

  const nodeData = metaRes.data.nodes[nodeId];
  if (!nodeData) {
    throw new Error(`[Figma] Node "${nodeId}" not found in file "${fileId}"`);
  }

  const node: FigmaNode = nodeData.document;
  const bbox = node.absoluteBoundingBox;

  // 2. Export image at 2x for high resolution
  const exportRes = await axios.get(`${FIGMA_API}/images/${fileId}`, {
    headers: { 'X-Figma-Token': token },
    params: {
      ids: nodeId,
      format: 'png',
      scale: 2,
    },
  });

  const imageUrl = exportRes.data.images[nodeId];
  if (!imageUrl) {
    throw new Error(`[Figma] Failed to get image URL for node "${nodeId}"`);
  }

  // 3. Download the PNG
  const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imgRes.data);

  return {
    screenName: config.name,
    source: 'figma',
    imageBuffer,
    width: bbox?.width ?? 0,
    height: bbox?.height ?? 0,
    metadata: {
      fileId,
      nodeId,
      nodeName: node.name,
      nodeType: node.type,
      boundingBox: bbox,
    },
  };
}

export async function listFigmaScreens(fileId: string, token: string): Promise<FigmaNode[]> {
  const res = await axios.get(`${FIGMA_API}/files/${fileId}`, {
    headers: { 'X-Figma-Token': token },
    params: { depth: 2 },
  });

  const pages = res.data.document?.children ?? [];
  const screens: FigmaNode[] = [];

  for (const page of pages) {
    for (const child of page.children ?? []) {
      if (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(child.type)) {
        screens.push({ id: child.id, name: child.name, type: child.type });
      }
    }
  }

  return screens;
}
