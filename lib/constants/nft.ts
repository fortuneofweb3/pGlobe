/**
 * Xandeum Official NFT Collections
 * 
 * NOTE: Collection IDs are placeholders until official mainnet addresses are provided.
 * These are used to scan wallet owners for NFT multipliers.
 */

export interface NFTCollection {
    name: string;
    multiplier: number;
    icon: string;
    collectionId?: string; // Solana Collection Mint address
    creatorId?: string;    // Alternative: Filter by Verified Creator
}

export const XANDEUM_NFT_COLLECTIONS: NFTCollection[] = [
    {
        name: 'Titan',
        multiplier: 11,
        icon: '⚡',
        collectionId: 'TITAN_COLLECTION_ID_PLACEHOLDER'
    },
    {
        name: 'Dragon',
        multiplier: 4,
        icon: '🐉',
        collectionId: 'DRAGON_COLLECTION_ID_PLACEHOLDER'
    },
    {
        name: 'Coyote',
        multiplier: 2.5,
        icon: '🐺',
        collectionId: 'COYOTE_COLLECTION_ID_PLACEHOLDER'
    },
    {
        name: 'Rabbit',
        multiplier: 1.5,
        icon: '🐰',
        collectionId: 'RABBIT_COLLECTION_ID_PLACEHOLDER'
    },
    {
        name: 'Cricket',
        multiplier: 1.1,
        icon: '🦗',
        collectionId: 'CRICKET_COLLECTION_ID_PLACEHOLDER'
    },
    {
        name: 'XENO',
        multiplier: 1.1,
        icon: '👽',
        collectionId: 'XENO_COLLECTION_ID_PLACEHOLDER'
    },
];

export function getNFTMultiplier(nftName: string): number {
    const nft = XANDEUM_NFT_COLLECTIONS.find(n => n.name === nftName);
    return nft ? nft.multiplier : 1.0;
}
