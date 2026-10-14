import type { APIRoute, GetStaticPaths } from 'astro';
import { agentResources, type AgentResource } from '../lib/agent-resources';
import { propertyRepository } from '../repositories/property-repository';
import { getSiteConfig } from '../config/site';

export const getStaticPaths: GetStaticPaths = async () => {
  const property = await propertyRepository.get();
  if (!property) throw new Error('Agent resources require valid property data');
  const config = await getSiteConfig();
  const origin = process.env.SITE_URL ?? config.site.url ?? 'https://nature-nook.si';
  return Object.entries(agentResources(property, origin)).map(([path, resource]) => ({
    params: { agentResource: path }, props: { resource },
  }));
};

export const GET: APIRoute = ({ props }) => {
  const resource = props.resource as AgentResource;
  return new Response(resource.body, { headers: {
    'Content-Type': resource.contentType,
    'Access-Control-Allow-Origin': '*',
    'Content-Signal': 'ai-train=no, search=yes, ai-input=yes',
  } });
};
