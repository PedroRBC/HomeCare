export interface House {
	id: string;
	name: string;
	description?: string;
	createdBy: string; // User ID who created the house
	createdAt: string;
	updatedAt: string;
	managers: HouseManager[];
	isActive: boolean;
}

export interface HouseManager {
	userId: string;
	email: string;
	displayName?: string;
	role: 'owner' | 'manager';
	addedAt: string;
	addedBy: string; // User ID who added this manager
}

export interface HouseInvitation {
	id: string;
	houseId: string;
	houseName: string;
	invitedEmail: string;
	invitedBy: string; // User ID who sent the invitation
	invitedByName: string;
	role: HouseRole;
	status: 'pending' | 'accepted' | 'declined' | 'expired';
	createdAt: string;
	expiresAt: string;
}

export interface UserHouseAccess {
	userId: string;
	houseId: string;
	role: 'owner' | 'manager';
	addedAt: string;
}

export type HouseRole = 'owner' | 'manager';
