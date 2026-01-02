export interface Era {
    name: string;
    boost: number;
    minItem: number;
    maxItem?: number;
    color: string;
    description: string;
}

export const XANDEUM_ERAS: Era[] = [
    {
        name: "Deep South Era",
        boost: 16,
        minItem: 0,
        maxItem: 2,
        color: "#F0A741",
        description: "The founding era of Xandeum pNodes."
    },
    {
        name: "South Era",
        boost: 10,
        minItem: 3,
        maxItem: 9,
        color: "#3F8277",
        description: "Expansion era with improved performance."
    },
    {
        name: "Main Era",
        boost: 7,
        minItem: 10,
        maxItem: 14,
        color: "#6366F1",
        description: "The core era for stable pNode operations."
    },
    {
        name: "Central Era",
        boost: 2,
        minItem: 15,
        maxItem: 20,
        color: "#EC4899",
        description: "Focus on decentralization and connectivity."
    },
    {
        name: "Coal Era",
        boost: 3.5,
        minItem: 21,
        maxItem: 25,
        color: "#6B7280",
        description: "Optimizing storage layer efficiency."
    },
    {
        name: "North Era",
        boost: 1.25,
        minItem: 26,
        color: "#10B981",
        description: "Scaling the network to its full potential."
    }
];

export interface MilestoneDetail {
    city: string;
    feature: string;
}

export const MILESTONE_DETAILS: Record<number, MilestoneDetail> = {
    // Deep South Era (0.1 - 0.2)
    1: { city: "Constance", feature: "Start pNode Network" },
    2: { city: "Freiburg", feature: "Create / Destroy File Systems" },

    // South Era (0.3 - 0.9)
    3: { city: "Munich", feature: "Working Prototype" },
    4: { city: "Herrenberg", feature: "Crude Search" },
    5: { city: "Ingolstadt", feature: "Basic pNode Rewards" },
    6: { city: "Stuttgart", feature: "Redundancy" },
    7: { city: "Heidelberg", feature: "Paging Stats" },
    8: { city: "Reinheim", feature: "Better Search" },
    9: { city: "Bamberg", feature: "Redundancy Stats" },

    // Main Era (1.0 - 1.4)
    10: { city: "Frankfurt", feature: "MVP (supporting info.wiki)" },
    11: { city: "Olef", feature: "Repair Pages" },
    12: { city: "Bonn", feature: "Evict & Replace" },
    13: { city: "Cologne", feature: "Simple BFT" },
    14: { city: "Erfurt", feature: "Initial Trust Anchors" },

    // Central Era (2.0 - 2.5)
    15: { city: "Hilden", feature: "Decentralized Atlas" },
    16: { city: "Neuss", feature: "Stake-Based Leader Schedule" },
    17: { city: "Düsseldorf", feature: "Merkle Trust Anchors" },
    18: { city: "Wuppertal", feature: "Threshold Signatures" },
    19: { city: "Velbert", feature: "ETH Trust Anchors" },
    20: { city: "Leipzig", feature: "Validator Challenges" },

    // Coal Era (3.0 - 3.4)
    21: { city: "Essen", feature: "Full BFT + Initial Fee Markets" },
    22: { city: "Bochum", feature: "Supply/Demand Observability" },
    23: { city: "Dortmund", feature: "Adaptive Fees" },
    24: { city: "Castrop-Rauxel", feature: "Tiered" },
    25: { city: "Datteln", feature: "Basic Auctions" },

    // North Era (4.0 - 4.4)
    26: { city: "Münster", feature: "Full Fee Markets + Initial Scale" },
    27: { city: "Berlin", feature: "Parallelization + Load Balancing" },
    28: { city: "Hamburg", feature: "Regions, High Concurrency" },
    29: { city: "Lübeck", feature: "Global Distri + Streaming" },
    30: { city: "Grömitz", feature: "Full Production-Grade Scale" },
};

export function getEraForItem(itemIndex: number): Era {
    return XANDEUM_ERAS.find(era =>
        itemIndex >= era.minItem && (era.maxItem === undefined || itemIndex <= era.maxItem)
    ) || XANDEUM_ERAS[0];
}

export function getMilestoneLabel(itemIndex: number): string {
    const detail = MILESTONE_DETAILS[itemIndex];
    if (detail) {
        return `${detail.city}: ${detail.feature}`;
    }
    return `Item ${itemIndex}`;
}

export function getItemForVersion(version?: string): number {
    if (!version) return 0;

    // Extract major and minor version numbers
    // Format: v0.5.1, 1.2.0, v0.8.0-trynet, etc.
    const match = version.match(/v?(\d+)\.(\d+)/);
    if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);

        // Mapping based on official doc rows:
        // v0.1-0.9 -> Item 1-9
        if (major === 0) return minor;

        // v1.0-1.4 -> Item 10-14
        if (major === 1) return 10 + minor;

        // v2.0-2.5 -> Item 15-20
        if (major === 2) return 15 + minor;

        // v3.0-3.4 -> Item 21-25
        if (major === 3) return 21 + minor;

        // v4.0-4.4 -> Item 26-30
        if (major === 4) return 26 + minor;

        // Fallback for higher versions
        return (major * 10) + minor;
    }

    return 0;
}
