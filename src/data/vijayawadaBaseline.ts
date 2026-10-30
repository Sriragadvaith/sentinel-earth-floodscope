import type { AppFeatureCollection } from "../types/geo";
import { DISASTER_RESPONSE_FEATURES } from "./disasterResponseData";

/**
 * Verified geospatial baseline for Vijayawada, Andhra Pradesh, India.
 * Coordinates are [longitude, latitude] (WGS84).
 * Center: [80.6480, 16.5062]
 */
export const VIJAYAWADA_BASELINE_DATA: AppFeatureCollection = {
  type: "FeatureCollection",
  features: [
    // -------------------------------------------------------------
    // WATERWAYS & WATER BODIES (Polygons + LineStrings)
    // -------------------------------------------------------------
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.5750, 16.5250],
            [80.5980, 16.5220],
            [80.6080, 16.5160],
            [80.6210, 16.5110],
            [80.6350, 16.5085], // Near Prakasam Barrage upstream
            [80.6430, 16.5040], // Prakasam Barrage
            [80.6550, 16.4980], // Downstream Padmavathi Ghat
            [80.6720, 16.4890], // Krishna Lanka riverbank
            [80.6900, 16.4800], // Downstream Ramalingeswara Nagar
            [80.7100, 16.4720], // Downstream towards Yanamalakuduru
            [80.7120, 16.4650],
            [80.6920, 16.4710],
            [80.6700, 16.4800],
            [80.6500, 16.4910],
            [80.6380, 16.4990],
            [80.6280, 16.5040],
            [80.6120, 16.5090],
            [80.5950, 16.5130],
            [80.5720, 16.5190],
            [80.5750, 16.5250]
          ]
        ]
      },
      properties: {
        id: "water-krishna-riverbed",
        name: "Krishna River Basin & Prakasam Reservoir",
        name_te: "కృష్ణా నది ప్రవాహ ప్రాంతం",
        category: "river",
        natural: "water",
        waterway: "riverbank",
        type: "River Basin / Reservoir",
        riskLevel: "critical",
        elevationApproxM: 18,
        description: "Primary drainage basin of the Krishna River through Vijayawada urban agglomeration. Critical monitor point at Prakasam Barrage.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.5890, 16.5230],
            [80.6050, 16.5200],
            [80.6150, 16.5170],
            [80.6080, 16.5130],
            [80.5920, 16.5160],
            [80.5890, 16.5230]
          ]
        ]
      },
      properties: {
        id: "water-bhavani-island",
        name: "Bhavani Island (Riverine Island)",
        name_te: "భవాని ద్వీపం",
        category: "river",
        natural: "wetland",
        type: "Riverine Island / Flood Reserve",
        riskLevel: "high",
        elevationApproxM: 19,
        description: "One of the largest river islands in India, surrounded by Krishna River waters upstream of Prakasam Barrage.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.5650, 16.5280],
          [80.5900, 16.5220],
          [80.6150, 16.5150],
          [80.6350, 16.5090],
          [80.6432, 16.5042], // Prakasam Barrage
          [80.6600, 16.4950],
          [80.6800, 16.4850],
          [80.7050, 16.4750],
          [80.7300, 16.4650]
        ]
      },
      properties: {
        id: "water-krishna-channel",
        name: "Krishna River Main Deep Channel",
        name_te: "కృష్ణా నది ప్రధాన ప్రవాహం",
        category: "river",
        waterway: "river",
        type: "Major Perennial River",
        riskLevel: "critical",
        elevationApproxM: 17,
        description: "Primary navigation and flood discharge thalweg through Vijayawada urban area.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6430, 16.5048],
          [80.6500, 16.5090],
          [80.6620, 16.5150],
          [80.6780, 16.5210],
          [80.6950, 16.5260],
          [80.7180, 16.5330]
        ]
      },
      properties: {
        id: "water-eluru-canal",
        name: "Eluru Canal (Major Irrigation & Flood Discharge)",
        name_te: "ఏలూరు కాలువ",
        category: "river",
        waterway: "canal",
        type: "Major Canal",
        riskLevel: "high",
        elevationApproxM: 20,
        description: "Originates at Prakasam Barrage, transverses Governorpet, Satyanarayanapuram, and Gunadala towards Eluru.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6435, 16.5045],
          [80.6530, 16.5065],
          [80.6650, 16.5085],
          [80.6800, 16.5095],
          [80.7000, 16.5080],
          [80.7250, 16.5040]
        ]
      },
      properties: {
        id: "water-ryves-canal",
        name: "Ryves Canal",
        name_te: "రైవ్స్ కాలువ",
        category: "river",
        waterway: "canal",
        type: "Urban Canal",
        riskLevel: "high",
        elevationApproxM: 21,
        description: "Cuts through core dense urban Vijayawada, prone to localized bank overflow during torrential precipitation.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6438, 16.5040],
          [80.6520, 16.5015],
          [80.6640, 16.4980],
          [80.6800, 16.4930],
          [80.7020, 16.4870],
          [80.7250, 16.4800]
        ]
      },
      properties: {
        id: "water-bandar-canal",
        name: "Bandar Canal",
        name_te: "బందరు కాలువ",
        category: "river",
        waterway: "canal",
        type: "Major Canal",
        riskLevel: "high",
        elevationApproxM: 20,
        description: "Flows southeast parallel to MG Road / Bandar Road, draining into Machilipatnam basin.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6200, 16.5400],
          [80.6350, 16.5350],
          [80.6550, 16.5300],
          [80.6750, 16.5250]
        ]
      },
      properties: {
        id: "water-budameru-diversion",
        name: "Budameru Rivulet & Diversion Channel",
        name_te: "బుడమేరు వాగు ప్రవాహం",
        category: "river",
        waterway: "stream",
        type: "Seasonal Stream / Flood Channel",
        riskLevel: "critical",
        elevationApproxM: 23,
        description: "Known historically as 'Sorrow of Vijayawada'; upstream flash flood surges threaten northern suburban settlements.",
        source: "osm-verified-baseline"
      }
    },

    // -------------------------------------------------------------
    // MAJOR ROADS & TRANSPORT ARTERIES (LineStrings)
    // -------------------------------------------------------------
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.5900, 16.4600],
          [80.6150, 16.4820],
          [80.6380, 16.4980],
          [80.6520, 16.5020], // Kanaka Durga Varadhi Bridge
          [80.6620, 16.5080], // Benz Circle
          [80.6800, 16.5200],
          [80.7050, 16.5350],
          [80.7300, 16.5500]  // Towards Gannavaram Airport
        ]
      },
      properties: {
        id: "road-nh16-highway",
        name: "NH 16 (Chennai - Kolkata Golden Quadrilateral)",
        name_te: "జాతీయ రహదారి 16",
        category: "roads",
        highway: "trunk",
        type: "Trunk Highway / Evacuation Artery",
        riskLevel: "moderate",
        elevationApproxM: 24,
        description: "Vital regional evacuation arterial corridor connecting Vijayawada with Guntur and Gannavaram Airport.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.5800, 16.5200],
          [80.6050, 16.5180],
          [80.6250, 16.5140],
          [80.6400, 16.5100], // Hyderabad road into One Town
          [80.6430, 16.5045], // Prakasam Barrage junction
          [80.6510, 16.5005], // PNBS corridor
          [80.6650, 16.4970],
          [80.6900, 16.4900],
          [80.7200, 16.4820]
        ]
      },
      properties: {
        id: "road-nh65-highway",
        name: "NH 65 (Hyderabad - Vijayawada - Machilipatnam)",
        name_te: "జాతీయ రహదారి 65",
        category: "roads",
        highway: "trunk",
        type: "Trunk Highway",
        riskLevel: "high",
        elevationApproxM: 22,
        description: "Major transport trunk traversing Bhavanipuram, Prakasam Barrage frontage, and Pandit Nehru Bus Station.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6430, 16.5042],
          [80.6380, 16.4950],
          [80.6320, 16.4850]
        ]
      },
      properties: {
        id: "road-prakasam-barrage-crossing",
        name: "Prakasam Barrage Road Connector",
        name_te: "ప్రకాశం బ్యారేజ్ రోడ్డు",
        category: "roads",
        highway: "primary",
        type: "Barrage Bridge Crossing",
        riskLevel: "critical",
        elevationApproxM: 21,
        description: "Historical barrage structure carrying bidirectional vehicular traffic across the Krishna River.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6500, 16.5020],
          [80.6420, 16.4920],
          [80.6350, 16.4800]
        ]
      },
      properties: {
        id: "road-kanaka-durga-varadhi",
        name: "Kanaka Durga Varadhi (Major River Viaduct)",
        name_te: "కనకదుర్గ వారధి",
        category: "roads",
        highway: "primary",
        type: "Multi-lane River Viaduct",
        riskLevel: "moderate",
        elevationApproxM: 28,
        description: "High-level 2.2 km road bridge spanning the Krishna River flood zone between Vijayawada and Tadepalli.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6300, 16.5160],
          [80.6420, 16.5110],
          [80.6550, 16.5080],
          [80.6620, 16.5080], // Benz Circle
          [80.6750, 16.5050],
          [80.6900, 16.5010],
          [80.7100, 16.4960]
        ]
      },
      properties: {
        id: "road-mg-road",
        name: "Mahatma Gandhi Road (Bandar Road)",
        name_te: "మహాత్మా గాంధీ రోడ్డు (బందరు రోడ్)",
        category: "roads",
        highway: "primary",
        type: "Arterial Commercial Spine",
        riskLevel: "moderate",
        elevationApproxM: 25,
        description: "The primary commercial artery of Vijayawada running eastward from Governorpet through Benz Circle to Patamata.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6280, 16.5180],
          [80.6400, 16.5160],
          [80.6550, 16.5180],
          [80.6700, 16.5220],
          [80.6900, 16.5280],
          [80.7150, 16.5360]
        ]
      },
      properties: {
        id: "road-eluru-road",
        name: "Eluru Road (Karl Marx Road)",
        name_te: "ఏలూరు రోడ్డు",
        category: "roads",
        highway: "primary",
        type: "Major Arterial Highway",
        riskLevel: "moderate",
        elevationApproxM: 26,
        description: "Dense urban thoroughfare parallel to the Eluru Canal passing through Satyanarayanapuram and Gunadala.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6440, 16.5030],
          [80.6580, 16.4950],
          [80.6750, 16.4860],
          [80.6950, 16.4780]
        ]
      },
      properties: {
        id: "road-krishna-lanka-bund",
        name: "Krishna Lanka Flood Bund Road",
        name_te: "కృష్ణా లంక కరకట్ట రోడ్డు",
        category: "roads",
        highway: "secondary",
        type: "River Embankment Service Road",
        riskLevel: "critical",
        elevationApproxM: 20,
        description: "Direct flood defense embankment road protecting the densely populated lowlands of Krishna Lanka.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [80.6620, 16.5080],
          [80.6650, 16.5200],
          [80.6720, 16.5350],
          [80.6850, 16.5450]
        ]
      },
      properties: {
        id: "road-inner-ring-road",
        name: "Inner Ring Road (BRTS Corridor)",
        name_te: "ఇన్నర్ రింగ్ రోడ్డు",
        category: "roads",
        highway: "secondary",
        type: "Circumferential Transit Route",
        riskLevel: "low",
        elevationApproxM: 27,
        description: "High-capacity multi-lane relief connector routing traffic away from low-lying riverfront chokepoints.",
        source: "osm-verified-baseline"
      }
    },

    // -------------------------------------------------------------
    // HOSPITALS & CRITICAL HEALTHCARE (Points AND Polygons)
    // -------------------------------------------------------------
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.6730, 16.5180],
            [80.6765, 16.5180],
            [80.6765, 16.5150],
            [80.6730, 16.5150],
            [80.6730, 16.5180]
          ]
        ]
      },
      properties: {
        id: "hospital-new-ggh-campus",
        name: "New Government General Hospital (GGH) Medical College Campus",
        name_te: "కొత్త ప్రభుత్వ సర్వజన ఆసుపత్రి",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Government of Andhra Pradesh",
        beds: 1200,
        type: "Tertiary Referral & Trauma Center",
        riskLevel: "low",
        elevationApproxM: 28,
        description: "Primary government tertiary care and disaster relief triage center for Krishna & NTR districts. High elevation campus.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6748, 16.5165]
      },
      properties: {
        id: "hospital-new-ggh-point",
        name: "New GGH Emergency Trauma Center",
        name_te: "కొత్త జీజీహెచ్ అత్యవసర కేంద్రం",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Govt NTR District",
        beds: 1200,
        type: "Regional Emergency Hub",
        riskLevel: "low",
        elevationApproxM: 28,
        description: "24/7 Level-1 trauma facility with helipad capacity and bulk medical oxygen storage.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6275, 16.5120]
      },
      properties: {
        id: "hospital-old-ggh",
        name: "Old Government General Hospital (Hanumanpet)",
        name_te: "పాత ప్రభుత్వ సర్వజన ఆసుపత్రి",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Govt of AP",
        beds: 450,
        type: "Urban District Hospital",
        riskLevel: "moderate",
        elevationApproxM: 23,
        description: "Historic government healthcare facility near Vijayawada Railway Station. Moderate flood vulnerability during localized waterlogging.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6605, 16.5135]
      },
      properties: {
        id: "hospital-ramesh-cardiac",
        name: "Ramesh Hospitals (ITI College Road)",
        name_te: "రమేష్ హాస్పిటల్స్",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Ramesh Healthcare Group",
        beds: 350,
        type: "Super-Specialty Cardiac & Emergency",
        riskLevel: "low",
        elevationApproxM: 26,
        description: "Advanced cardiac life support and acute stroke center. Elevated ground floor infrastructure.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6475, 16.5095]
      },
      properties: {
        id: "hospital-andhra-hospitals",
        name: "Andhra Hospitals (Suryaraopet)",
        name_te: "ఆంధ్రా హాస్పిటల్స్",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Andhra Hospitals Ltd",
        beds: 280,
        type: "Pediatric & Multi-Specialty",
        riskLevel: "moderate",
        elevationApproxM: 22,
        description: "Pediatric intensive care and specialized emergency response unit in central commercial district.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.6310, 16.4880],
            [80.6350, 16.4880],
            [80.6350, 16.4850],
            [80.6310, 16.4850],
            [80.6310, 16.4880]
          ]
        ]
      },
      properties: {
        id: "hospital-manipal-campus",
        name: "Manipal Hospital Campus (Tadepalli - Varadhi)",
        name_te: "మణిపాల్ హాస్పిటల్",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Manipal Health Enterprises",
        beds: 320,
        type: "Quaternary Care Hospital",
        riskLevel: "high",
        elevationApproxM: 21,
        description: "Prominent quaternary care center located across Kanaka Durga Varadhi. Proximity to Krishna floodplain requires flood wall monitoring.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6330, 16.4865]
      },
      properties: {
        id: "hospital-manipal-point",
        name: "Manipal Hospital Emergency & Trauma Unit",
        name_te: "మణిపాల్ అత్యవసర కేంద్రం",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Manipal Health Enterprises",
        beds: 320,
        type: "Emergency & Trauma Facility",
        riskLevel: "high",
        elevationApproxM: 21,
        description: "High-acuity ICU, ECMO, and emergency trauma triage directly accessible from NH16.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6690, 16.5050]
      },
      properties: {
        id: "hospital-ayush-hospital",
        name: "Ayush Multi-Specialty Hospital (Ring Road)",
        name_te: "ఆయుష్ హాస్పిటల్",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Ayush Healthcare",
        beds: 200,
        type: "Comprehensive Emergency Hospital",
        riskLevel: "low",
        elevationApproxM: 25,
        description: "Equipped with dedicated critical care ambulances and on-site blood bank reserves.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.7020, 16.4910]
      },
      properties: {
        id: "hospital-kamineni-poranki",
        name: "Kamineni Hospital (Bandar Road / Poranki)",
        name_te: "కామినేని హాస్పిటల్",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Kamineni Health",
        beds: 250,
        type: "Multi-Specialty Facility",
        riskLevel: "low",
        elevationApproxM: 27,
        description: "Strategic healthcare outpost serving eastern metropolitan expansion along Bandar Road corridor.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [80.6860, 16.5380]
      },
      properties: {
        id: "hospital-pinnamaneni-siddhartha",
        name: "Dr. Pinnamaneni Siddhartha Medical Institute",
        name_te: "డాక్టర్ పిన్నమనేని సిద్ధార్థ ఇన్స్టిట్యూట్",
        category: "hospitals",
        amenity: "hospital",
        emergency: "yes",
        operator: "Siddhartha Academy",
        beds: 790,
        type: "Teaching Hospital & Disaster Triage",
        riskLevel: "low",
        elevationApproxM: 29,
        description: "Massive medical complex on high ground north of Vijayawada, safe haven staging facility.",
        source: "osm-verified-baseline"
      }
    },

    // -------------------------------------------------------------
    // VULNERABLE LOW-LYING URBAN FLOOD SECTORS (Polygons)
    // -------------------------------------------------------------
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.6480, 16.5020],
            [80.6650, 16.4930],
            [80.6820, 16.4830],
            [80.6860, 16.4890],
            [80.6700, 16.4980],
            [80.6550, 16.5050],
            [80.6480, 16.5020]
          ]
        ]
      },
      properties: {
        id: "zone-krishna-lanka-lowland",
        name: "Krishna Lanka Low-Lying Riverfront Ward",
        name_te: "కృష్ణా లంక ముంపు ప్రభావిత ప్రాంతం",
        category: "floodZones",
        type: "High Exposure Flood Plain",
        riskLevel: "critical",
        elevationApproxM: 19,
        description: "High-density residential belt situated directly behind Krishna bund. High vulnerability during major upstream discharge events.",
        source: "osm-verified-baseline"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.6880, 16.4820],
            [80.7080, 16.4740],
            [80.7150, 16.4820],
            [80.6950, 16.4900],
            [80.6880, 16.4820]
          ]
        ]
      },
      properties: {
        id: "zone-ramalingeswara-nagar",
        name: "Ramalingeswara Nagar Flood Inundation Fringe",
        name_te: "రామలింగేశ్వర నగర్ వరద ప్రభావిత ప్రాంతం",
        category: "floodZones",
        type: "Riparian Inundation Zone",
        riskLevel: "high",
        elevationApproxM: 20,
        description: "Low-lying settlement downstream along the northern riverbank. Susceptible to water accumulation during heavy rainfall and Krishna backwater.",
        source: "osm-verified-baseline"
      }
    },
    ...DISASTER_RESPONSE_FEATURES
  ]
};
