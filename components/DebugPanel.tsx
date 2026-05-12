"use client";

import { useUIStore } from "@/lib/store/uiStore";

export default function DebugPanel() {
  const { cars, selectedCarId, setSelectedCarId } = useUIStore();

  return (
    <div className="w-80 shrink-0 overflow-y-auto bg-gray-950 border-l border-gray-800 text-xs font-mono">
      <div className="sticky top-0 bg-gray-900 px-3 py-2 font-bold text-gray-300 border-b border-gray-700">
        Debug — {cars.length} cars
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-gray-500 text-left border-b border-gray-800">
            <th className="px-2 py-1">id</th>
            <th className="px-2 py-1">x</th>
            <th className="px-2 py-1">y</th>
            <th className="px-2 py-1">vx</th>
            <th className="px-2 py-1">lane</th>
            <th className="px-2 py-1">intent</th>
            <th className="px-2 py-1">peers</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr
              key={car.id}
              onClick={() =>
                setSelectedCarId(car.id === selectedCarId ? null : car.id)
              }
              className={`cursor-pointer border-b border-gray-900 hover:bg-gray-800 ${
                car.id === selectedCarId ? "bg-blue-950" : ""
              }`}
            >
              <td className="px-2 py-0.5 text-blue-400">{car.id}</td>
              <td className="px-2 py-0.5">{car.x.toFixed(0)}</td>
              <td className="px-2 py-0.5">{car.y.toFixed(1)}</td>
              <td className="px-2 py-0.5">{car.vx.toFixed(1)}</td>
              <td className="px-2 py-0.5">{car.lane}</td>
              <td
                className={`px-2 py-0.5 ${
                  car.intent === "exiting"
                    ? "text-orange-400"
                    : car.intent === "merging"
                    ? "text-pink-400"
                    : "text-gray-400"
                }`}
              >
                {car.intent}
              </td>
              <td className="px-2 py-0.5 text-gray-500">{car.radioPeers.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
