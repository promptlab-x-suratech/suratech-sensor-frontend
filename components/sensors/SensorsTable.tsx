"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react"
import { Pagination } from "@mui/material"
import { createTheme, ThemeProvider } from "@mui/material/styles"
import StatusBadge from "./StatusBadge"
import { getSensors } from "@/lib/data/sensors"
import type { Sensor } from "@/lib/types"

type SortField = "serialNumber" | "machineName" | "status" | "lastUpdated"
type SortDirection = "asc" | "desc"

// Create a custom MUI theme for the pagination component
const paginationTheme = createTheme({
  palette: {
    primary: {
      main: "#3b82f6", // blue-500
    },
    text: {
      primary: "#ffffff",
      secondary: "#ffffff",
    },
  },
  components: {
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          color: "#ffffff",
          "&.Mui-selected": {
            backgroundColor: "#3b82f6",
            color: "#ffffff",
          },
          "&:hover": {
            backgroundColor: "rgba(59, 130, 246, 0.2)",
          },
        },
        icon: {
          color: "#ffffff",
        },
      },
    },
  },
})

export default function SensorsTable() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSensors, setTotalSensors] = useState(0)
  const [sortField, setSortField] = useState<SortField>("serialNumber")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const router = useRouter()
  const sensorsPerPage = 50 // Increased from 20 to 50

  useEffect(() => {
    const fetchSensors = async () => {
      const { sensors: fetchedSensors, total } = await getSensors({
        page,
        limit: sensorsPerPage,
      })

      // Sort sensors
      const sortedSensors = [...fetchedSensors].sort((a, b) => {
        if (sortField === "lastUpdated") {
          return sortDirection === "asc" ? a.lastUpdated - b.lastUpdated : b.lastUpdated - a.lastUpdated
        }

        const aValue = a[sortField]?.toString().toLowerCase() || ""
        const bValue = b[sortField]?.toString().toLowerCase() || ""

        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      })

      setSensors(sortedSensors)
      setTotalSensors(total)
      setTotalPages(Math.ceil(total / sensorsPerPage))
    }

    fetchSensors()
  }, [page, sortField, sortDirection])

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (field !== sortField) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
  }

  const handleRowClick = (sensorId: string) => {
    router.push(`/sensors/${sensorId}`)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {sensors.length} of {totalSensors} sensors
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Page {page} of {totalPages}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("serialNumber")}
                  className="font-medium flex items-center"
                >
                  Serial Number {renderSortIcon("serialNumber")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("machineName")}
                  className="font-medium flex items-center"
                >
                  Machine {renderSortIcon("machineName")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("status")} className="font-medium flex items-center">
                  Status {renderSortIcon("status")}
                </Button>
              </TableHead>
              <TableHead>Temperature</TableHead>
              <TableHead>Vibration (X, Y, Z)</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastUpdated")}
                  className="font-medium flex items-center"
                >
                  Last Updated {renderSortIcon("lastUpdated")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sensors.map((sensor) => {
              const latestReading = sensor.readings[sensor.readings.length - 1]

              return (
                <TableRow
                  key={sensor.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleRowClick(sensor.id)}
                >
                  <TableCell className="font-medium">{sensor.serialNumber}</TableCell>
                  <TableCell>{sensor.machineName}</TableCell>
                  <TableCell>
                    <StatusBadge status={sensor.status} />
                  </TableCell>
                  <TableCell>{latestReading.temperature.toFixed(1)}°C</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <span className="text-sm">
                        X: <span className="font-medium">{latestReading.vibrationX.toFixed(2)}</span>
                      </span>
                      <span className="text-sm">
                        Y: <span className="font-medium">{latestReading.vibrationY.toFixed(2)}</span>
                      </span>
                      <span className="text-sm">
                        Z: <span className="font-medium">{latestReading.vibrationZ.toFixed(2)}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(sensor.lastUpdated)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-center mt-6">
        <ThemeProvider theme={paginationTheme}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </ThemeProvider>
      </div>
    </div>
  )
}
