/**
 * Xandeum Official NFT Collections
 * 
 * NFT boost factors for STOINC calculation.
 * Collection IDs will be populated once discovered from manager wallets.
 */

export interface NFTCollection {
    name: string;
    multiplier: number;
    icon: string;
    collectionId?: string; // Solana Collection Mint address
    creator?: string;      // Verified Creator Address
}

export const XANDEUM_NFT_COLLECTIONS: NFTCollection[] = [
    {
        name: 'Titan',
        multiplier: 11, // 1,000% boost
        icon: '⚡',
        collectionId: 'H8C2FfJ5vYyPJHn3B1Ea7u6bS8yE4fC2mS1bB3d5eG7', // Fallback
        creator: 'EKBaGra9E7yCqBBaobHcF3UM7J9tKWet6XVJWihvaYrK' // Xandeum DeepSouth Creator
    },
    {
        name: 'Dragon',
        multiplier: 4, // 300% boost
        icon: '🐉',
        collectionId: 'AevD1ypsjQxdn9CV34pKh8qbSChYuVaLDReeaCg18mv1', // DeepSouth Dragon
        creator: 'EKBaGra9E7yCqBBaobHcF3UM7J9tKWet6XVJWihvaYrK'
    },
    {
        name: 'Rabbit',
        multiplier: 1.5, // 50% boost
        icon: '🐰',
        collectionId: '2jwFQbyVxAbx9vZAH8AAPTNw9R955ELfEJUB9H6JNyke', // DeepSouth Rabbit
        creator: 'EKBaGra9E7yCqBBaobHcF3UM7J9tKWet6XVJWihvaYrK'
    },
    {
        name: 'Founders',
        multiplier: 1.25, // Estimate for Founders
        icon: 'wd',
        collectionId: 'Founders_Club_Passport',
        creator: 'DrDFSxtKfvTLEGULkSJLVq7b1HeySCGStkXLibThTxky' // Bitoku Founders Club
    },
    {
        name: 'XENO',
        multiplier: 1.1, // 10% boost
        icon: '👽',
        collectionId: 'XENO_Placeholder'
    },
];

/**
 * pNode Purchase Era Boost Factors
 * Based on when the pNode was purchased
 */
export interface EraBoost {
    name: string;
    multiplier: number;
    label: string;
}

export const PNODE_ERA_BOOSTS: EraBoost[] = [
    { name: 'DeepSouth', multiplier: 16, label: 'Deep South Era (1,500% boost)' },
    { name: 'South', multiplier: 10, label: 'South Era (900% boost)' },
    { name: 'Main', multiplier: 7, label: 'Main Era (600% boost)' },
    { name: 'Coal', multiplier: 3.5, label: 'Coal Era (250% boost)' },
    { name: 'Central', multiplier: 2, label: 'Central Era (100% boost)' },
    { name: 'North', multiplier: 1.25, label: 'North Era (25% boost)' },
    { name: 'Standard', multiplier: 1, label: 'Standard (no boost)' },
];

export function getNFTMultiplier(nftName: string): number {
    const nft = XANDEUM_NFT_COLLECTIONS.find(n => n.name === nftName);
    return nft ? nft.multiplier : 1.0;
}

export function getEraMultiplier(eraName: string): number {
    const era = PNODE_ERA_BOOSTS.find(e => e.name === eraName);
    return era ? era.multiplier : 1.0;
}
