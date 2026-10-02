export function createDemoData(now = Date.now()) {
  const reading = (id, minutesAgo, waterLevel) => ({
    id,
    station_id: 'DEMO-RIVER-01',
    water_level: waterLevel,
    rate_of_rise: null,
    flow_condition: 'Example trend only',
    recorded_at: new Date(now - minutesAgo * 60000).toISOString(),
    sensor_status: 'ONLINE',
  });

  return {
    readings: [
      reading('demo-reading-1', 35, 2.12),
      reading('demo-reading-2', 25, 2.24),
      reading('demo-reading-3', 15, 2.38),
      reading('demo-reading-4', 5, 2.48),
    ],
    sensors: [{
      station_id: 'DEMO-RIVER-01',
      name: 'Example monitoring station',
      status: 'ONLINE',
      latitude: null,
      longitude: null,
      last_heartbeat: new Date(now - 5 * 60000).toISOString(),
    }],
    alerts: [
      {
        id: 'demo-alert-watch',
        title: 'Example: River level is rising',
        message: 'DEMO ONLY. Residents should monitor official updates.',
        severity: 'WATCH',
        created_at: new Date(now - 3 * 3600000).toISOString(),
        is_active: false,
        location: 'Example location',
        status: 'RESOLVED',
      },
      {
        id: 'demo-alert-warning',
        title: 'Example: Prepare for possible evacuation',
        message: 'DEMO ONLY. This is sample alert history, not an active warning.',
        severity: 'WARNING',
        created_at: new Date(now - 2 * 3600000).toISOString(),
        is_active: false,
        location: 'Example location',
        status: 'RESOLVED',
      },
      {
        id: 'demo-alert-critical',
        title: 'Example: Follow official emergency instructions',
        message: 'DEMO ONLY. This sample does not indicate a real flood emergency.',
        severity: 'CRITICAL',
        created_at: new Date(now - 1 * 3600000).toISOString(),
        is_active: false,
        location: 'Example location',
        status: 'RESOLVED',
      },
    ],
    announcements: [
      {
        id: 'demo-announcement-weather',
        title: 'Example weather advisory',
        message: 'DEMO ONLY. Check official local advisories for current weather information.',
        created_at: new Date(now - 2 * 3600000).toISOString(),
        is_active: true,
        category: 'Weather Advisory',
        issuing_office: 'Example issuing office',
      },
      {
        id: 'demo-announcement-safety',
        title: 'Example community safety update',
        message: 'DEMO ONLY. This example announcement is not an official evacuation notice.',
        created_at: new Date(now - 1 * 3600000).toISOString(),
        is_active: true,
        category: 'General Announcement',
        issuing_office: 'Example issuing office',
      },
    ],
  };
}