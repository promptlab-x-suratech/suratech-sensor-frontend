export type SensorStatus = "ok" | "warning" | "critical"

export interface SensorReading {
  timestamp: number
  temperature: number
  vibrationX: number
  vibrationY: number
  vibrationZ: number
}

export interface Sensor {
  id: string
  serialNumber: string
  machineName: string
  location: string
  installationDate: number
  lastUpdated: number
  readings: SensorReading[]
  status: SensorStatus
  maintenanceHistory: { 
    date: number
    description: string
    technician?: string
    type?: string
    partsReplaced?: string
  }[]
  // New fields for card display
  name: string
  model: string
  operationalStatus: "running" | "standby" | "alarm"
  batteryLevel: number
  connectivity: "online" | "offline"
  signalStrength: number
  vibrationH: "normal" | "warning" | "critical"
  vibrationV: "normal" | "warning" | "critical"
  vibrationA: "normal" | "warning" | "critical"
  // Store raw API data
  last_data?: any
}

export interface Machine {
  id: string
  name: string
  type: string
  location: string
  installationDate: number
  sensors: string[]
  status: "operational" | "maintenance" | "offline" | "warning"
  lastMaintenance?: number
  nextMaintenance?: number
  model?: string
  manufacturer?: string
  
}

export interface Alert {
  id: string
  sensorId: string
  type: "temperature" | "vibration" | "connectivity" | "battery"
  severity: "low" | "medium" | "high" | "critical"
  message: string
  timestamp: number
  acknowledged: boolean
  resolvedAt?: number
}

export interface SensorFilters {
  status?: "all" | "ok" | "warning" | "critical"
  search?: string
  page?: number
  limit?: number
}

export interface SensorSummary {
  totalSensors: number
  activeSensors: number
  criticalAlerts: number
  criticalAlertsChange: number
  warningAlerts: number
  warningAlertsChange: number
  avgTemperature: number
  minTemperature: number
  maxTemperature: number
  avgVibration: {
    x: number
    y: number
    z: number
  }
  temperatureData: Array<{
    name: string
    min: number
    avg: number
    max: number
  }>
  vibrationData: Array<{
    name: string
    x: number
    y: number
    z: number
  }>
}
