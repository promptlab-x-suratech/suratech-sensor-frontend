"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, MoreVertical, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getSensorById } from "@/lib/data/sensors"
import { formatDate } from "@/lib/utils"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
// Import fft.js
import FFT from "fft.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// Conversion functions for vibration data
function adcToAccelerationG(adcValue: number, range = 2): number {
  const offset = 512
  let sensitivity: number

  // Set sensitivity based on range (±2G, ±4G, ±8G, ±16G)
  switch (range) {
    case 2:
      sensitivity = 17367
      break
    case 4:
      sensitivity = 8684
      break
    case 8:
      sensitivity = 4342
      break
    case 16:
      sensitivity = 2171
      break
    default:
      sensitivity = 17367 // Default to ±2G
  }

  return (adcValue - offset) / sensitivity
}

function accelerationGToMmPerSecSquared(accelerationG: number): number {
  return accelerationG * 9806.65
}

function accelerationToVelocity(accelerations: number[], timeInterval: number): number[] {
  // First point of velocity is 0
  const velocities: number[] = [0]

  for (let i = 0; i < accelerations.length - 1; i++) {
    // Velocity (mm/s) = ½(ti+1-ti) * (Acceleration (mm/s²)i + Acceleration (mm/s²)i+1)
    const velocity = 0.5 * timeInterval * (accelerations[i] + accelerations[i + 1])
    velocities.push(velocities[velocities.length - 1] + velocity)
  }

  return velocities
}

// Static sampling rate in Hz (matching the Python example)
const SAMPLING_RATE = 50.0

// FFT implementation using fft.js library
function calculateFFT(timeData: number[]): { magnitude: number[]; frequency: number[] } {
  // Make sure the length is a power of 2 for FFT
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(timeData.length)))

  // Create FFT instance
  const fft = new FFT(nextPow2)

  // Prepare input data (zero-padding if needed)
  const input = new Float64Array(nextPow2)
  for (let i = 0; i < timeData.length; i++) {
    input[i] = timeData[i]
  }

  // Prepare output data
  const output = new Float64Array(nextPow2 * 2) // Complex output (real, imag pairs)

  // Perform FFT
  fft.realTransform(output, input)

  // Calculate magnitude and frequency
  const n = timeData.length
  const halfLength = n
  const magnitude: number[] = []
  const frequency: number[] = []

  // Process the first half of the FFT result (up to Nyquist frequency)
  for (let i = 0; i < halfLength; i++) {
    // Get real and imaginary parts
    const real = output[i * 2]
    const imag = output[i * 2 + 1]

    // Calculate magnitude using the Python formula: 2.56 / n * abs(fft_res)
    const abs = Math.sqrt(real * real + imag * imag)
    magnitude.push((2.56 / n) * abs)

    // Calculate frequency
    frequency.push((i * SAMPLING_RATE) / n)
  }

  return { magnitude, frequency }
}

// First, update the SensorLastData interface to properly handle the vibration data arrays
interface SensorLastData {
  id: string
  name: string
  sensor_type: string | null
  unit: string | null
  data: {
    datetime: string
    x: number[]
    y: number[]
    z: number[]
    temperature: number
    battery: number
  }
}

export default function SensorDetailPage() {
  const router = useRouter()
  const params = useParams() as { id: string }
  const [sensor, setSensor] = useState<any>(null)
  const [sensorLastData, setSensorLastData] = useState<SensorLastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAxis, setSelectedAxis] = useState("H-axis")
  const [selectedUnit, setSelectedUnit] = useState("Acceleration (G)")
  const [error, setError] = useState<string | null>(null)
  const [vibrationStats, setVibrationStats] = useState({
    rms: "0.000",
    peak: "0.000",
    status: "Normal",
  })

  // Update the fetchSensorLastData function to handle the vibration data arrays
  const fetchSensorLastData = async (sensorId: string) => {
    try {
      const response = await fetch(`https://sc.promptlabai.com/suratech/sensors/${sensorId}/last-data`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log("Fetched sensor data:", data)
      setSensorLastData(data)
      return data
    } catch (error) {
      console.error("Error fetching sensor last data:", error)
      setError("Failed to fetch sensor data from API")
      return null
    }
  }

  const fetchSensor = async () => {
    try {
      // Fetch sensor basic info
      const data = await getSensorById(params.id)

      // Fetch real-time sensor data
      const lastData = await fetchSensorLastData(params.id)

      if (data) {
        setSensor(data)
      } else if (lastData) {
        // Create sensor from API data if not found in our database
        setSensor({
          id: params.id,
          name: lastData.name,
          serialNumber: `S-${params.id.substring(0, 4).toUpperCase()}`,
          machine: "API Machine",
          location: "API Location",
          temperature: lastData.data.temperature,
          vibrationX: lastData.data.x,
          vibrationY: lastData.data.y,
          vibrationZ: lastData.data.z,
          status: "ok",
          battery: lastData.data.battery,
          lastUpdated: lastData.data.datetime,
          installationDate: "2025-04-26",
        })
      } else {
        // Create a fallback sensor if not found
        setSensor({
          id: params.id,
          name: `Sensor ${params.id.substring(0, 8)}`,
          serialNumber: `S-${params.id.substring(0, 4).toUpperCase()}`,
          machine: "Test Machine",
          location: "Test Location",
          temperature: 27.0,
          vibrationX: 0.54,
          vibrationY: 0.97,
          vibrationZ: 0.6,
          status: "ok",
          battery: 80,
          lastUpdated: new Date().toISOString(),
          installationDate: "2025-04-26",
        })
      }
    } catch (error) {
      console.error("Error fetching sensor:", error)
      setError("Failed to fetch sensor data")
      // Create a fallback sensor on error
      setSensor({
        id: params.id,
        name: `Sensor ${params.id.substring(0, 8)}`,
        serialNumber: `S-${params.id.substring(0, 4).toUpperCase()}`,
        machine: "Test Machine",
        location: "Test Location",
        temperature: 27.0,
        vibrationX: 0.54,
        vibrationY: 0.97,
        vibrationZ: 0.6,
        status: "ok",
        battery: 80,
        lastUpdated: new Date().toISOString(),
        installationDate: "2025-04-26",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSensor()
  }, [params.id])

  useEffect(() => {
    // Calculate vibration statistics when sensor data changes
    if (sensorLastData?.data) {
      const { x, y, z } = sensorLastData.data

      // Check if we have array data
      if (Array.isArray(x) && Array.isArray(y) && Array.isArray(z) && x.length > 0) {
        // Convert ADC values to G
        const xG = x.map((adc) => adcToAccelerationG(adc))
        const yG = y.map((adc) => adcToAccelerationG(adc))
        const zG = z.map((adc) => adcToAccelerationG(adc))

        // Calculate RMS
        const rmsX = Math.sqrt(xG.reduce((sum, val) => sum + val * val, 0) / xG.length)
        const rmsY = Math.sqrt(yG.reduce((sum, val) => sum + val * val, 0) / yG.length)
        const rmsZ = Math.sqrt(zG.reduce((sum, val) => sum + val * val, 0) / zG.length)
        const rmsTotal = Math.sqrt((rmsX * rmsX + rmsY * rmsY + rmsZ * rmsZ) / 3)

        // Calculate peak
        const peakX = Math.max(...xG.map(Math.abs))
        const peakY = Math.max(...yG.map(Math.abs))
        const peakZ = Math.max(...zG.map(Math.abs))
        const peakTotal = Math.max(peakX, peakY, peakZ)

        // Determine status
        const status = rmsTotal > 0.8 ? "Critical" : rmsTotal > 0.5 ? "Warning" : "Normal"

        setVibrationStats({
          rms: rmsTotal.toFixed(3),
          peak: peakTotal.toFixed(3),
          status,
        })
      } else {
        // Use single values if arrays are not available
        const xG = typeof x === "number" ? x : 0
        const yG = typeof y === "number" ? y : 0
        const zG = typeof z === "number" ? z : 0

        const rmsTotal = Math.sqrt((xG * xG + yG * yG + zG * zG) / 3)
        const peakTotal = Math.max(Math.abs(xG), Math.abs(yG), Math.abs(zG))
        const status = rmsTotal > 0.8 ? "Critical" : rmsTotal > 0.5 ? "Warning" : "Normal"

        setVibrationStats({
          rms: rmsTotal.toFixed(3),
          peak: peakTotal.toFixed(3),
          status,
        })
      }
    }
  }, [sensorLastData])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!sensor) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
        <h2 className="text-2xl font-bold">Sensor not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
          Back to Sensors
        </Button>
      </div>
    )
  }

  // Use real data if available, otherwise use sensor data or fallback
  const currentData = sensorLastData?.data || {
    temperature: sensor.temperature || 0,
    x: sensor.vibrationX || 0,
    y: sensor.vibrationY || 0,
    z: sensor.vibrationZ || 0,
    battery: sensor.battery || 0,
    datetime: sensor.lastUpdated || new Date().toISOString(),
  }

  // Ensure all values are numbers
  const safeTemp = Number(currentData.temperature) || 0
  const safeX = Number(currentData.x) || 0
  const safeY = Number(currentData.y) || 0
  const safeZ = Number(currentData.z) || 0
  const safeBattery = Number(currentData.battery) || 0

  // Function to prepare vibration data for charts
  const prepareVibrationData = () => {
    // Check if we have real vibration data
    if (
      !sensorLastData?.data ||
      !Array.isArray(sensorLastData.data.x) ||
      !Array.isArray(sensorLastData.data.y) ||
      !Array.isArray(sensorLastData.data.z) ||
      sensorLastData.data.x.length === 0
    ) {
      return {
        hasData: false,
        timeData: null,
        freqData: null,
      }
    }

    // Get the appropriate axis data based on selection
    const rawAxisData =
      selectedAxis === "H-axis"
        ? sensorLastData.data.x
        : selectedAxis === "V-axis"
          ? sensorLastData.data.y
          : sensorLastData.data.z

    // Calculate time interval based on sampling rate
    const timeInterval = 1 / SAMPLING_RATE
    const n = rawAxisData.length
    const timeLabels = Array.from({ length: n }, (_, i) => (i * timeInterval).toFixed(4))

    // Process data based on selected unit
    let processedData: number[]
    let yAxisLabel: string

    if (selectedUnit === "Acceleration (G)") {
      // Convert ADC to Acceleration (G)
      processedData = rawAxisData.map((adc) => adcToAccelerationG(adc))
      yAxisLabel = "Acceleration (G)"
    } else if (selectedUnit === "Acceleration (mm/s²)") {
      // Convert ADC to Acceleration (G) then to mm/s²
      processedData = rawAxisData.map((adc) => accelerationGToMmPerSecSquared(adcToAccelerationG(adc)))
      yAxisLabel = "Acceleration (mm/s²)"
    } else {
      // Velocity (mm/s)
      // Convert ADC to Acceleration (G) then to mm/s² then to Velocity
      const accelerations = rawAxisData.map((adc) => accelerationGToMmPerSecSquared(adcToAccelerationG(adc)))
      processedData = accelerationToVelocity(accelerations, timeInterval)
      yAxisLabel = "Velocity (mm/s)"
    }

    // Create time domain chart data
    const timeChartData = {
      labels: timeLabels,
      datasets: [
        {
          label: yAxisLabel,
          data: processedData,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.1)",
          tension: 0.1,
          pointRadius: 0,
        },
      ],
    }

    // Calculate FFT for frequency domain (using fft.js)
    const { magnitude, frequency } = calculateFFT(processedData)

    // Create frequency domain chart data
    const freqChartData = {
      labels: frequency,
      datasets: [
        {
          label: `${yAxisLabel} Magnitude`,
          data: magnitude,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.1)",
          tension: 0.1,
          pointRadius: 0,
        },
      ],
    }

    return {
      hasData: true,
      timeData: timeChartData,
      freqData: freqChartData,
      yAxisLabel,
    }
  }

  const vibrationData = prepareVibrationData()

  const timeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: "Time (s)",
          color: "#888",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "#888",
        },
      },
      y: {
        title: {
          display: true,
          text: vibrationData?.yAxisLabel || "Acceleration (G)",
          color: "#888",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "#888",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  }

  const freqChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: "Frequency (Hz)",
          color: "#888",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "#888",
        },
      },
      y: {
        title: {
          display: true,
          text: vibrationData?.yAxisLabel ? `${vibrationData.yAxisLabel} Magnitude` : "Magnitude",
          color: "#888",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "#888",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  }

  // Format vibration values from real data
  const vibrationH = safeX.toFixed(2)
  const vibrationV = safeY.toFixed(2)
  const vibrationA = safeZ.toFixed(2)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            className="mr-4 bg-transparent border-gray-700 hover:bg-gray-800"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sensor
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sensor: {sensorLastData?.name || sensor.name}</h1>
            <p className="text-gray-400">
              {sensor.machine || "Monitoring Test Machine"} • {sensor.location || "Test Location"}
              {sensorLastData && (
                <span className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-900 text-blue-300">Live Data</span>
              )}
            </p>
            <p className="text-sm text-gray-500">Last updated: {formatDate(currentData.datetime)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-transparent border-gray-700 hover:bg-gray-800">
            <Calendar className="mr-2 h-4 w-4" /> May 19, 2025 - May 26, 2025
          </Button>
          <Button variant="outline" className="bg-transparent border-gray-700 hover:bg-gray-800" onClick={() => router.push(`/sensors/${sensor.id}/history`)}>
            View History
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="bg-transparent border-gray-700 hover:bg-gray-800">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
              <DropdownMenuItem>Export Data</DropdownMenuItem>
              <DropdownMenuItem>Print Report</DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-2 rounded-md mb-4">
            {error}. Using fallback data.
          </div>
        )}

        {/* Horizontal Sensor Information */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 flex justify-center">
                <div className="w-24 h-24 bg-gray-700 rounded-md flex items-center justify-center">
                  <div className="text-3xl text-gray-500">{(sensorLastData?.name || sensor.name).charAt(0)}</div>
                </div>
              </div>

              <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Sensor Information</h2>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Serial Number</span>
                      <span>{sensor.serialNumber || "S-JBK7"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type</span>
                      <span>{sensorLastData?.sensor_type || "Vibration Sensor"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Unit</span>
                      <span>{sensorLastData?.unit || "G"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Machine</span>
                      <span>{sensor.machine || "Test Machine"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Location</span>
                      <span>{sensor.location || "Test Location"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Status</span>
                    <div className="flex items-center">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          sensor.status === "offline" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"
                        }`}
                      >
                        {sensor.status === "offline" ? "Offline" : "OK"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Temperature</span>
                      <span>{safeTemp.toFixed(1)}°C</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Battery</span>
                      <span>{safeBattery}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Updated</span>
                      <span>{formatDate(currentData.datetime, true)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Installation Date</span>
                      <span>{formatDate(sensor.installationDate || "2025-04-26")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Operational Time</span>
                      <span>{sensor.operationalDays || "30"} days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics and Analysis */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <h3 className="text-gray-400 mb-2">Temperature Statistics</h3>
                <div className="text-2xl font-bold">{safeTemp.toFixed(1)}°C</div>
                <div className="text-sm text-gray-500">
                  Status: {safeTemp > 35 ? "Critical" : safeTemp > 30 ? "Warning" : "Normal"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <h3 className="text-gray-400 mb-2">Vibration Statistics</h3>
                <div className="text-2xl font-bold">{vibrationStats.rms}G RMS</div>
                <div className="text-sm text-gray-500">
                  Peak: {vibrationStats.peak}G • Status: {vibrationStats.status}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vibration Analysis Section */}
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold mb-4">Vibration Frequency Analysis</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Select value={selectedAxis} onValueChange={setSelectedAxis}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select axis" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="H-axis">H-axis (X)</SelectItem>
                    <SelectItem value="V-axis">V-axis (Y)</SelectItem>
                    <SelectItem value="A-axis">A-axis (Z)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="Acceleration (G)">Acceleration (G)</SelectItem>
                    <SelectItem value="Acceleration (mm/s²)">Acceleration (mm/s²)</SelectItem>
                    <SelectItem value="Velocity (mm/s)">Velocity (mm/s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(() => {
                if (!vibrationData.hasData) {
                  return (
                    <div className="flex flex-col items-center justify-center h-64 bg-gray-800 border border-gray-700 rounded-md">
                      <p className="text-gray-400">No vibration data available for this sensor</p>
                    </div>
                  )
                }

                // Calculate statistics from real data
                const axisData =
                  selectedAxis === "H-axis"
                    ? sensorLastData?.data?.x || []
                    : selectedAxis === "V-axis"
                      ? sensorLastData?.data?.y || []
                      : sensorLastData?.data?.z || []

                const absValues = axisData.map(Math.abs)
                const sum = absValues.reduce((acc, val) => acc + val, 0)
                const avg = sum / absValues.length
                const max = Math.max(...absValues)
                const min = Math.min(...absValues)

                // Scale values for better display
                const scaleFactor = 1000
                const rmsValue = (
                  Math.sqrt(absValues.reduce((acc, val) => acc + val * val, 0) / absValues.length) / scaleFactor
                ).toFixed(3)
                const peakValue = (max / scaleFactor).toFixed(3)
                const peakToPeakValue = ((max - min) / scaleFactor).toFixed(3)

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-900 border border-gray-800 rounded-md p-4">
                        <h4 className="text-xl font-medium mb-6">Overall Statistics</h4>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-lg">RMS :</span>
                            <span className="text-lg">{rmsValue} G</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-lg">Peak :</span>
                            <span className="text-lg">{peakValue} G</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-lg">Peak to Peak :</span>
                            <span className="text-lg">{peakToPeakValue} G</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-900 border border-gray-800 rounded-md p-4">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center font-medium">Axis</div>
                          <div className="text-center font-medium">Value (Avg)</div>
                          <div className="text-center font-medium">Status</div>
                        </div>
                        <div className="space-y-4">
                          {["H-axis", "V-axis", "A-axis"].map((axis, index) => {
                            const axisData =
                              axis === "H-axis"
                                ? sensorLastData?.data?.x || []
                                : axis === "V-axis"
                                  ? sensorLastData?.data?.y || []
                                  : sensorLastData?.data?.z || []

                            const absValues = axisData.map(Math.abs)
                            const sum = absValues.reduce((acc, val) => acc + val, 0)
                            const avgValue = (sum / absValues.length / scaleFactor).toFixed(2)

                            // Determine status based on average value
                            const axisAvg = sum / absValues.length / scaleFactor
                            const status = axisAvg > 0.8 ? "High" : axisAvg > 0.5 ? "Med" : "Low"
                            const statusClass =
                              axisAvg > 0.8
                                ? "bg-red-900 text-red-300"
                                : axisAvg > 0.5
                                  ? "bg-yellow-900 text-yellow-300"
                                  : "bg-green-900 text-green-300"

                            return (
                              <div key={axis} className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  {axis.split("-")[0]} ({axis.charAt(0)})
                                </div>
                                <div className="text-center">{avgValue}G</div>
                                <div className="text-center">
                                  <span className={`px-2 py-1 text-xs rounded-full ${statusClass}`}>{status}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-4">Time domain</h3>
                      <div className="h-64 bg-gray-800 border border-gray-700 rounded-md p-2">
                        {vibrationData.timeData && (
                          <Line
                            data={vibrationData.timeData}
                            options={{
                              ...timeChartOptions,
                              scales: {
                                ...timeChartOptions.scales,
                                y: {
                                  ...timeChartOptions.scales.y,
                                  title: {
                                    ...timeChartOptions.scales.y.title,
                                    text: vibrationData.yAxisLabel || "Acceleration (G)",
                                  },
                                },
                              },
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-4">Frequency domain</h3>
                      <div className="h-64 bg-gray-800 border border-gray-700 rounded-md p-2">
                        {vibrationData.freqData && (
                          <Line
                            data={vibrationData.freqData}
                            options={{
                              ...freqChartOptions,
                              scales: {
                                ...freqChartOptions.scales,
                                y: {
                                  ...freqChartOptions.scales.y,
                                  title: {
                                    ...freqChartOptions.scales.y.title,
                                    text: vibrationData.yAxisLabel
                                      ? `${vibrationData.yAxisLabel} Magnitude`
                                      : "Magnitude",
                                  },
                                },
                              },
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
