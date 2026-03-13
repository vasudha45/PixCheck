import axios from 'axios';
import { DesignAsset, ScreenConfig } from '../../types';

const ZEPLIN_API = 'https://api.zeplin.dev/v1';

export async function fetchZeplinScreen(
  config: ScreenConfig,
  token: string
): Promise<DesignAsset> {
  if (!config.zeplinProjectId || !config.zeplinScreenId) {
    throw new Error(`[Zeplin] zeplinProjectId and zeplinScreenId are required for screen "${config.name}"`);
  }

  const headers = { Authorization: `Bearer ${token}` };
  const { zeplinProjectId: projectId, zeplinScreenId: screenId } = config;

  // 1. Fetch screen metadata
  const metaRes = await axios.get(
    `${ZEPLIN_API}/projects/${projectId}/screens/${screenId}`,
    { headers }
  );

  const screenData = metaRes.data;
  const imageUrl: string | undefined =
    screenData?.image?.original_url ||
    screenData?.image?.url ||
    screenData?.thumbnails?.find((t: { width: number; url: string }) => t.width >= 1440)?.url ||
    screenData?.thumbnails?.[0]?.url;

  if (!imageUrl) {
    throw new Error(`[Zeplin] Could not find image URL for screen "${screenId}"`);
  }

  // 2. Download the image
  const imgRes = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    headers,
  });

  const imageBuffer = Buffer.from(imgRes.data);

  return {
    screenName: config.name,
    source: 'zeplin',
    imageBuffer,
    width: screenData?.width ?? 0,
    height: screenData?.height ?? 0,
    metadata: {
      projectId,
      screenId,
      screenName: screenData?.name,
      description: screenData?.description,
      tags: screenData?.tags,
      createdAt: screenData?.created,
      updatedAt: screenData?.updated,
    },
  };
}

export async function listZeplinScreens(
  projectId: string,
  token: string
): Promise<{ id: string; name: string; section?: string }[]> {
  const headers = { Authorization: `Bearer ${token}` };

  const res = await axios.get(`${ZEPLIN_API}/projects/${projectId}/screens`, {
    headers,
    params: { limit: 100 },
  });

  return (res.data ?? []).map((s: { id: string; name: string; section?: { name: string } }) => ({
    id: s.id,
    name: s.name,
    section: s.section?.name,
  }));
}

export async function listZeplinComponents(
  styleguideId: string,
  token: string
): Promise<{ id: string; name: string }[]> {
  const headers = { Authorization: `Bearer ${token}` };

  const res = await axios.get(`${ZEPLIN_API}/styleguides/${styleguideId}/components`, {
    headers,
    params: { limit: 100 },
  });

  return (res.data ?? []).map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
}
