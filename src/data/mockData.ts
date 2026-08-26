import { ProjectFolder, LayerItem, Waypoint, Track, TeamMember, FieldNotification, FieldRound, FireIncident } from '../types';

export const initialProjects: ProjectFolder[] = [
  {
    id: 'proj-default',
    name: 'Meu Projeto',
    description: 'Área de trabalho para navegação e marcações em campo.',
    locationName: 'Campo',
    centerCoordinate: { lat: -23.5505, lng: -46.6333, altitude: 760 },
    zoomLevel: 13,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Geral'],
    encryptionEnabled: true,
    stats: {
      waypointsCount: 0,
      tracksCount: 0,
      layersCount: 0,
      areaCoveredHectares: 0,
      teamMembersCount: 1,
    },
    permissions: {
      super_admin: true,
      field_lead: true,
      surveyor: true,
      auditor: true,
    },
  },
];

export const initialLayers: LayerItem[] = [];
export const initialWaypoints: Waypoint[] = [];
export const initialTracks: Track[] = [];
export const initialTeamMembers: TeamMember[] = [];
export const initialNotifications: FieldNotification[] = [];
export const initialFieldRounds: FieldRound[] = [];


export const initialFireIncidents: FireIncident[] = [];
