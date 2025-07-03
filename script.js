// script.js

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("truckForm");
    const errorDiv = document.getElementById("errorMessages");
    const resultsDiv = document.getElementById("results");

    const inputs = [
        {
            name: "targetTime",
            label: "Target Time (in minutes)",
            description: "The time limit within which a maximum number of trucks must be loaded (in minutes)",
            type: "number",
            validate: v => v > 0,
            error: "Input should be a strictly positive real number"
        },
        {
            name: "targetTimeMargin",
            label: "Error margin for target time",
            description: "The acceptable margin of error between 0 and 1 on the target time",
            type: "number",
            validate: v => v >= 0 && v <= 1,
            error: "Input should be a real number between 0 and 1 (inclusive)"
        },
        {
            name: "volumes",
            label: "Available truck types volumes (in m³)",
            description: "A list of available truck types with their volumes in the form [a, b, c], where each value represents a different truck type volume in m³. The optimizer will determine how many trucks of each type to use.",
            type: "text",
            validate: v => /^\[(\s*\d*\.?\d+\s*,)*\s*\d*\.?\d+\s*\]$/.test(v) && JSON.parse(v).every(n => n > 0),
            error: "Input should be written in this format [a, b, c, d ...] where each element is a strictly positive real number representing a truck type volume"
        },
        {
            name: "flowRate",
            label: "Flow rate (in m³/h)",
            description: "The flow rate for loading the various trucks in (m³/h)",
            type: "number",
            validate: v => v > 0,
            error: "Input should be a strictly positive real number"
        },
        {
            name: "flowRateMargin",
            label: "Error margin for loading time",
            description: "Error margin between 0 and 1 on truck loading time.",
            type: "number",
            validate: v => v >= 0 && v <= 1,
            error: "Input should be a real number between 0 and 1 (inclusive)"
        },
        {
            name: "numBays",
            label: "Number of available bays",
            description: "Number of available loading bays (One bay can load one truck)",
            type: "number",
            validate: v => Number.isInteger(v) && v > 0,
            error: "Input should be a strictly positive integer"
        },
        {
            name: "distance",
            label: "Travel Distance (in km)",
            description: "The distance between the starting point and the loading bays (in km)",
            type: "number",
            validate: v => v > 0,
            error: "Input should be a strictly positive real number"
        },
        {
            name: "speed",
            label: "Average speed (in km/h)",
            description: "The average speed of the truck during the process (in km/h)",
            type: "number",
            validate: v => v > 0,
            error: "Input should be a strictly positive real number"
        },
        {
            name: "speedMargin",
            label: "Error margin for average speed",
            description: "Error margin between 0 and 1 on average speed.",
            type: "number",
            validate: v => v >= 0 && v <= 1,
            error: "Input should be a real number between 0 and 1 (inclusive)"
        },
        {
            name: "protocol1",
            label: "First protocol duration (in minutes)",
            description: "The duration of the control protocol before loading (in minutes).",
            type: "number",
            validate: v => v > 0,
            error: "Input should be a strictly positive real number"
        },
        {
            name: "protocol1Margin",
            label: "Error margin for First protocol duration",
            description: "Error margin between 0 and 1 on First protocol duration.",
            type: "number",
            validate: v => v >= 0 && v <= 1,
            error: "Input should be a real number between 0 and 1 (inclusive)"
        },
        {
            name: "protocol2",
            label: "Second protocol duration (in minutes)",
            description: "The duration of the control protocol after loading (in minutes).",
            type: "number",
            validate: v => v > 0,
            error: "Input should be a strictly positive real number"
        },
        {
            name: "protocol2Margin",
            label: "Error margin for Second protocol duration",
            description: "Error margin between 0 and 1 on Second protocol duration.",
            type: "number",
            validate: v => v >= 0 && v <= 1,
            error: "Input should be a real number between 0 and 1 (inclusive)"
        }
    ];

    const createInputElement = ({ name, label, description, type }) => {
        const container = document.createElement("div");
        container.innerHTML = `
      <label for="${name}">${label}</label>
      <small>${description}</small>
      <input type="${type}" id="${name}" name="${name}" step="0.01" />
      <div class="error" id="error-${name}"></div>
    `;
        return container;
    };

    inputs.forEach(input => {
        form.appendChild(createInputElement(input));
    });

    const objectiveContainer = document.createElement("div");
    objectiveContainer.innerHTML = `
    <fieldset>
      <legend>Target Objective</legend>
      <label><input type="radio" name="objective" value="maxTrucks" checked /> Maximize number of loaded trucks</label><br/>
      <label><input type="radio" name="objective" value="maxVolume" /> Maximize total volume transported</label><br/>
      <label><input type="radio" name="objective" value="maxEfficiency" /> Maximize volume efficiency (volume / processing time)</label>
    </fieldset>
    <button type="submit">Run Optimization</button>
  `;
    form.appendChild(objectiveContainer);

    const validateInputs = () => {
        let valid = true;
        inputs.forEach(({ name, validate, error }) => {
            const input = document.getElementById(name);
            const value = input.type === "text" ? input.value : parseFloat(input.value);
            const errorDiv = document.getElementById("error-" + name);
            try {
                if (isNaN(value) && input.type !== "text") {
                    errorDiv.textContent = "Please enter a valid number";
                    valid = false;
                } else if (!validate(value)) {
                    errorDiv.textContent = error;
                    valid = false;
                } else {
                    errorDiv.textContent = "";
                }
            } catch {
                errorDiv.textContent = error;
                valid = false;
            }
        });
        return valid;
    };

    const messageBox = document.createElement("div");
    messageBox.id = "messageBox";
    messageBox.style.marginTop = "20px";
    form.insertAdjacentElement("afterend", messageBox);

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!validateInputs()) return;

        const data = {};
        inputs.forEach(({ name }) => {
            const input = document.getElementById(name);
            data[name] = input.type === "text" ? input.value : parseFloat(input.value);
        });

        const objective = document.querySelector('input[name="objective"]:checked').value;
        try {
            data.volumes = JSON.parse(data.volumes);
        } catch (err) {
            alert("Error parsing volumes input");
            return;
        }

        const minProcessTime = data.protocol1 + data.protocol2 + 2 * (data.distance / data.speed * 60);
        const maxAllowedTime = data.targetTime;

        if (minProcessTime > maxAllowedTime) {
            messageBox.innerHTML = `
        <div style='border: 2px solid red; padding: 10px; background: #ffe6e6; color: darkred;'>
          <h3>Critical Error</h3>
          <p>The sum of initial protocol, travel time and final protocol exceeds the total allowed time.</p>
          <p>No truck can be processed in the available time. Please increase the target time or reduce travel/protocol durations.</p>
          <button onclick="window.location.reload()">Return</button>
        </div>`;
            return;
        }

        const result = optimizeTrucks(data, objective);
        let anyFeasible = result.some(r => r.numTrucks > 0);
        if (!anyFeasible) {
            messageBox.innerHTML = `
        <div style='border: 2px solid orange; padding: 10px; background: #fff4e6; color: #b36b00;'>
          <h3>Warning</h3>
          <p>No truck configuration can be completed within the target time, even with all bays in use.</p>
          <p>Please try reducing volumes, increasing flow rate or extending target time.</p>
        </div>`;
        } else {
            messageBox.innerHTML = "";
        }

        displayResults(result);
    });

    function optimizeTrucks(data, objective) {
        const {
            targetTime,
            targetTimeMargin,
            volumes,
            flowRate,
            flowRateMargin,
            numBays,
            distance,
            speed,
            speedMargin,
            protocol1,
            protocol1Margin,
            protocol2,
            protocol2Margin
        } = data;

        const marginModes = ["optimistic", "average", "pessimistic"];
        const results = [];

        for (let mode of marginModes) {
            // CORRECTION: Logique des marges corrigée
            let m = mode === "optimistic" ? 1 : mode === "pessimistic" ? -1 : 0;

            // Calculate processing time for each truck type
            let truckTypes = [];
            for (let v of volumes) {
                // Pour les protocoles et temps de trajet: optimiste = plus court, pessimiste = plus long
                let t1 = protocol1 * (1 - m * protocol1Margin);
                let t2 = protocol2 * (1 - m * protocol2Margin);
                let travelTime = (distance / (speed * (1 + m * speedMargin))) * 60;
                let loadingTime = (v / (flowRate * (1 + m * flowRateMargin))) * 60;
                let totalTime = t1 + travelTime + loadingTime + travelTime + t2;
                truckTypes.push({ volume: v, time: totalTime });
            }

            // Sort truck types based on objective
            truckTypes.sort((a, b) => {
                if (objective === "maxTrucks") {
                    // To maximize number of trucks, prioritize faster trucks
                    return a.time - b.time;
                }
                if (objective === "maxVolume") {
                    // To maximize volume, prioritize larger volumes
                    return b.volume - a.volume;
                }
                if (objective === "maxEfficiency") {
                    // To maximize efficiency, prioritize best volume/time ratio
                    return (b.volume / b.time) - (a.volume / a.time);
                }
                return 0;
            });

            // Greedy algorithm to fill available bays
            let schedule = [];
            let bays = Array(numBays).fill(0);
            // Pour le temps cible: optimiste = plus de temps disponible, pessimiste = moins de temps
            let targetTimeLimit = targetTime * (1 + m * targetTimeMargin);

            // Keep trying to add trucks until no more can fit
            let improved = true;
            while (improved) {
                improved = false;

                // Try each truck type in order of priority
                for (let truckType of truckTypes) {
                    // Find the bay with minimum current load that can accommodate this truck
                    let bestBay = -1;
                    let minLoad = Infinity;

                    for (let i = 0; i < bays.length; i++) {
                        if (bays[i] + truckType.time <= targetTimeLimit && bays[i] < minLoad) {
                            bestBay = i;
                            minLoad = bays[i];
                        }
                    }

                    // If we found a suitable bay, add the truck
                    if (bestBay !== -1) {
                        bays[bestBay] += truckType.time;
                        schedule.push({
                            volume: truckType.volume,
                            time: truckType.time,
                            bay: bestBay + 1
                        });
                        improved = true;

                        // For maxTrucks, we want to add as many trucks as possible
                        // For maxVolume and maxEfficiency, we might want to break after adding one of the priority type
                        if (objective === "maxVolume" || objective === "maxEfficiency") {
                            break;
                        }
                    }
                }
            }

            // Calculate statistics
            const volumeDistribution = {};
            for (let v of volumes) {
                volumeDistribution[v] = 0;
            }
            schedule.forEach(truck => {
                volumeDistribution[truck.volume]++;
            });

            let totalVolume = schedule.reduce((acc, truck) => acc + truck.volume, 0);
            let totalTime = schedule.reduce((acc, truck) => acc + truck.time, 0);
            let avgTime = schedule.length ? (totalTime / schedule.length) : 0;
            let efficiency = totalTime > 0 ? (totalVolume / totalTime) * 60 : 0; // m³/h

            results.push({
                mode,
                totalVolume,
                numTrucks: schedule.length,
                avgTime: avgTime.toFixed(2),
                efficiency: efficiency.toFixed(3),
                distribution: volumeDistribution,
                bayUtilization: bays.map(time => ((time / targetTimeLimit) * 100).toFixed(1))
            });
        }

        return results;
    }

    function checkModerateCases(results, volumes, numBays) {
        const allSameVolume = volumes.every(v => v === volumes[0]);
        const maxTrucksUsed = Math.max(...results.map(r => r.numTrucks));
        const avgBayUtilization = results.map(r =>
            r.bayUtilization.reduce((sum, util) => sum + parseFloat(util), 0) / r.bayUtilization.length
        );
        const maxAvgUtilization = Math.max(...avgBayUtilization);

        // Check if all bays are saturated (>95% average utilization)
        const baysSaturated = maxAvgUtilization > 95;

        // Check if bays are underused (<30% average utilization)
        const baysUnderused = maxAvgUtilization < 30;

        // Check which truck types are being used
        const usedTruckTypes = new Set();
        results.forEach(result => {
            Object.entries(result.distribution).forEach(([volume, count]) => {
                if (count > 0) {
                    usedTruckTypes.add(parseFloat(volume));
                }
            });
        });
        const unusedTruckTypes = volumes.filter(v => !usedTruckTypes.has(v));

        // Check for significant differences between scenarios
        const trucksRange = Math.max(...results.map(r => r.numTrucks)) - Math.min(...results.map(r => r.numTrucks));
        const highVariability = trucksRange > Math.max(1, maxTrucksUsed * 0.3);

        let messages = [];

        if (allSameVolume && volumes.length > 1) {
            messages.push({
                type: "info",
                message: "All truck types have the same volume. The choice of truck type is not significant in this case."
            });
        }

        if (baysSaturated) {
            messages.push({
                type: "warning",
                message: `Loading bays are saturated (${maxAvgUtilization.toFixed(1)}% utilization). Adding more bays could significantly improve results.`
            });
        }

        if (baysUnderused && numBays > 1) {
            messages.push({
                type: "suggestion",
                message: `Bays are underused (${maxAvgUtilization.toFixed(1)}% utilization). You could reduce the number of bays or extend the target time to process more trucks.`
            });
        }

        if (unusedTruckTypes.length > 0) {
            messages.push({
                type: "warning",
                message: `Some truck types (${unusedTruckTypes.join(', ')} m³) are not being used. They may be too slow or inefficient given current constraints.`
            });
        }

        if (highVariability) {
            messages.push({
                type: "caution",
                message: `High variability between scenarios (${trucksRange} trucks difference). Error margins have significant impact - consider reducing uncertainties.`
            });
        }

        // Check if optimization is actually making good use of available truck types
        const truckTypesUsed = usedTruckTypes.size;
        const truckTypesAvailable = volumes.length;
        if (truckTypesUsed < truckTypesAvailable && truckTypesAvailable > 1) {
            messages.push({
                type: "info",
                message: `Using ${truckTypesUsed} out of ${truckTypesAvailable} available truck types. This is optimal given the current constraints and objective.`
            });
        }

        // Specific case: very low efficiency
        const minEfficiency = Math.min(...results.map(r => parseFloat(r.efficiency)));
        if (minEfficiency < 5) {
            messages.push({
                type: "warning",
                message: `Very low efficiency (${minEfficiency.toFixed(2)} m³/h). Protocol or transport times seem too high compared to loading flow rate.`
            });
        }

        return messages;
    }

    function displayResults(results) {
        resultsDiv.innerHTML = "<h2>Results</h2>";

        // Get the original volumes array for analysis
        const originalVolumes = JSON.parse(document.getElementById("volumes").value);

        const suggestions = checkModerateCases(results, originalVolumes, parseInt(document.getElementById("numBays").value));
        if (suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const infoBox = document.createElement("div");

                // Styling based on message type
                switch (suggestion.type) {
                    case "warning":
                        infoBox.style.border = "2px solid #ff6b35";
                        infoBox.style.background = "#fff4f0";
                        infoBox.style.color = "#cc2900";
                        break;
                    case "caution":
                        infoBox.style.border = "2px solid #ffa500";
                        infoBox.style.background = "#fffaf0";
                        infoBox.style.color = "#cc6600";
                        break;
                    case "suggestion":
                        infoBox.style.border = "2px solid #28a745";
                        infoBox.style.background = "#f0fff4";
                        infoBox.style.color = "#155724";
                        break;
                    default: // info
                        infoBox.style.border = "2px solid #0074D9";
                        infoBox.style.background = "#e6f2ff";
                        infoBox.style.color = "#004080";
                }

                infoBox.style.padding = "10px";
                infoBox.style.marginBottom = "10px";
                infoBox.innerHTML = `<h4>${suggestion.type.toUpperCase()}</h4><p>${suggestion.message}</p>`;
                resultsDiv.appendChild(infoBox);
            });
        }

        results.forEach(res => {
            let table = "<table class='result-table'>";
            table += `<tr><th colspan="2">${res.mode.toUpperCase()} SCENARIO</th></tr>`;
            table += `<tr><td>Total Volume Transported</td><td>${res.totalVolume.toFixed(2)} m³</td></tr>`;
            table += `<tr><td>Number of Trucks Used</td><td>${res.numTrucks}</td></tr>`;
            table += `<tr><td>Average Duration per Truck</td><td>${res.avgTime} min</td></tr>`;
            table += `<tr><td>Volume Efficiency</td><td>${res.efficiency} m³/h</td></tr>`;
            table += `<tr><td colspan="2"><b>Trucks Used by Type</b></td></tr>`;
            for (let vol in res.distribution) {
                if (res.distribution[vol] > 0) {
                    table += `<tr><td>${vol} m³ trucks</td><td>${res.distribution[vol]} truck(s)</td></tr>`;
                }
            }
            table += `<tr><td colspan="2"><b>Bay Utilization (%)</b></td></tr>`;
            res.bayUtilization.forEach((util, idx) => {
                table += `<tr><td>Bay ${idx + 1}</td><td>${util}%</td></tr>`;
            });
            table += "</table><br/>";
            resultsDiv.innerHTML += table;
        });
    }
});