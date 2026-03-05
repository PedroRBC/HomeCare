import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { House, HouseInvitation, HouseRole } from '@/types/house.types';
import { FirestoreService } from '@/services/firestore';
import { logger } from '@/utils/logger';

interface HouseContextType {
	// Current house state
	currentHouse: House | null;
	userHouses: House[];
	userRole: HouseRole | null;

	// Loading states
	isLoading: boolean;
	isInitialized: boolean;
	isSwitchingHouses: boolean;

	// House management
	createHouse: (name: string, description?: string) => Promise<House>;
	selectHouse: (houseId: string) => Promise<void>;
	updateHouse: (houseId: string, updates: Partial<House>) => Promise<void>;
	deleteHouse: (houseId: string) => Promise<void>;

	// Manager management
	addManager: (houseId: string, email: string) => Promise<void>;
	removeManager: (houseId: string, userId: string) => Promise<void>;
	updateManagerRole: (houseId: string, userId: string, role: HouseRole) => Promise<void>;

	// Invitations
	invitations: HouseInvitation[];
	sendInvitation: (houseId: string, email: string) => Promise<void>;
	acceptInvitation: (invitationId: string) => Promise<void>;
	declineInvitation: (invitationId: string) => Promise<void>;

	// Utility
	refreshHouses: () => Promise<void>;
	clearHouseData: () => void;
	clearCurrentHouseSelection: () => void;
}

const HouseContext = createContext<HouseContextType | undefined>(undefined);

interface HouseProviderProps {
	children: ReactNode;
}

export const HouseProvider: React.FC<HouseProviderProps> = ({ children }) => {
	const { user } = useAuth();
	const [currentHouse, setCurrentHouse] = useState<House | null>(null);
	const [userHouses, setUserHouses] = useState<House[]>([]);
	const [userRole, setUserRole] = useState<HouseRole | null>(null);
	const [invitations, setInvitations] = useState<HouseInvitation[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isSwitchingHouses, setIsSwitchingHouses] = useState(false);

	const loadUserHouses = useCallback(async () => {
		if (!user?.uid) return;

		try {
			// This will be implemented in FirestoreService
			const houses = await FirestoreService.getUserHouses(user.uid);
			setUserHouses(houses);

			// If user has houses but no current house selected, select the first one
			// Note: This will be handled separately to avoid circular dependencies
		} catch (error) {
			console.error('Error loading user houses:', error);
		}
	}, [user?.uid]);

	const loadInvitations = useCallback(async () => {
		if (!user?.uid || !user?.email) return;

		try {
			const userInvitations = await FirestoreService.getUserInvitations(user.uid, user.email);
			setInvitations(userInvitations);
		} catch (error) {
			console.error('Error loading invitations:', error);
		}
	}, [user?.uid, user?.email]);

	const initializeHouseData = useCallback(async () => {
		if (!user?.uid) return;

		try {
			setIsLoading(true);
			logger.log('Initializing house data for user:', user.uid);

			// Load user's houses
			await loadUserHouses();

			// Load pending invitations
			await loadInvitations();

			setIsInitialized(true);
		} catch (error) {
			console.error('Error initializing house data:', error);
		} finally {
			setIsLoading(false);
		}
	}, [user?.uid, loadUserHouses, loadInvitations]);

	const clearHouseData = useCallback(() => {
		logger.log("HouseContext: Clearing house data - user should remain logged in");
		logger.log("HouseContext: Current house before clearing:", currentHouse?.name);
		setCurrentHouse(null);
		setUserHouses([]);
		setUserRole(null);
		setInvitations([]);
		setIsLoading(false);
		setIsInitialized(false);
		logger.log("HouseContext: House data cleared successfully");
	}, [currentHouse?.name]);

	const clearCurrentHouseSelection = useCallback(() => {
		logger.log("HouseContext: Clearing current house selection only - keeping user houses list");
		logger.log("HouseContext: Current house before clearing:", currentHouse?.name);
		setIsSwitchingHouses(true);
		setCurrentHouse(null);
		setUserRole(null);
		logger.log("HouseContext: Current house selection cleared, user houses list preserved");
	}, [currentHouse?.name]);

	// Initialize house data when user changes
	useEffect(() => {
		if (!user?.uid) {
			clearHouseData();
			return;
		}

		initializeHouseData();
	}, [user?.uid, initializeHouseData, clearHouseData]);

	const refreshHouses = useCallback(async (): Promise<void> => {
		await loadUserHouses();
	}, [loadUserHouses]);

	const selectHouse = useCallback(async (houseId: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			// First try to find the house in current state
			let house = userHouses.find(h => h.id === houseId);

			// If not found in current state, try to fetch it from Firestore
			if (!house) {
				logger.log('House not found in current state, fetching from Firestore...');
				await refreshHouses();
				house = userHouses.find(h => h.id === houseId);
			}

			if (!house) throw new Error('House not found');

			// Check if user has access to this house
			const manager = house.managers.find(m => m.userId === user.uid);
			if (!manager) throw new Error('No access to this house');

			setCurrentHouse(house);
			setUserRole(manager.role);
			setIsSwitchingHouses(false); // Reset switching flag when house is selected

			// Store selected house in local storage for persistence
			// This will be implemented later

			logger.log('Selected house:', house.name, 'Role:', manager.role);
		} catch (error) {
			console.error('Error selecting house:', error);
			throw error;
		}
	}, [user?.uid, userHouses, refreshHouses]);

	// Auto-select first house when houses are loaded and no house is selected
	// But only if the user is not intentionally switching houses
	useEffect(() => {
		if (userHouses.length > 0 && !currentHouse && isInitialized && !isSwitchingHouses) {
			logger.log("HouseContext: Auto-selecting first house:", userHouses[0].name);
			selectHouse(userHouses[0].id);
		}
	}, [userHouses, currentHouse, isInitialized, isSwitchingHouses, selectHouse]);

	const createHouse = async (name: string, description?: string): Promise<House> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			logger.log('Creating house:', name, 'for user:', user.uid);
			const house = await FirestoreService.createHouse({
				name,
				description,
				createdBy: user.uid,
			});

			logger.log('House created successfully:', house.id, house.name);

			// Add to user houses
			setUserHouses(prev => {
				const newHouses = [house, ...prev];
				logger.log('Updated userHouses state with', newHouses.length, 'houses');
				return newHouses;
			});

			// Select the new house directly (don't need to find it in state)
			setCurrentHouse(house);
			setUserRole('owner'); // Creator is always the owner
			setIsSwitchingHouses(false); // Reset switching flag when house is created and selected

			logger.log('Created and selected house:', house.name, 'Role: owner');

			return house;
		} catch (error) {
			console.error('Error creating house:', error);
			throw error;
		}
	};

	const updateHouse = async (houseId: string, updates: Partial<House>): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.updateHouse(houseId, updates);

			// Update local state
			setUserHouses(prev => prev.map(house =>
				house.id === houseId ? { ...house, ...updates, updatedAt: new Date().toISOString() } : house
			));

			if (currentHouse?.id === houseId) {
				setCurrentHouse(prev => prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : null);
			}
		} catch (error) {
			console.error('Error updating house:', error);
			throw error;
		}
	};

	const deleteHouse = async (houseId: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.deleteHouse(houseId);

			// Remove from local state
			setUserHouses(prev => prev.filter(house => house.id !== houseId));

			// If deleted house was current, select another house or clear
			if (currentHouse?.id === houseId) {
				const remainingHouses = userHouses.filter(h => h.id !== houseId);
				if (remainingHouses.length > 0) {
					await selectHouse(remainingHouses[0].id);
				} else {
					setCurrentHouse(null);
					setUserRole(null);
				}
			}
		} catch (error) {
			console.error('Error deleting house:', error);
			throw error;
		}
	};

	const addManager = async (houseId: string, email: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.addHouseManager(houseId, email, user.uid);
			await refreshHouses();
		} catch (error) {
			console.error('Error adding manager:', error);
			throw error;
		}
	};

	const removeManager = async (houseId: string, userId: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.removeHouseManager(houseId, userId);
			await refreshHouses();
		} catch (error) {
			console.error('Error removing manager:', error);
			throw error;
		}
	};

	const updateManagerRole = async (houseId: string, userId: string, role: HouseRole): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.updateHouseManagerRole(houseId, userId, role);
			await refreshHouses();
		} catch (error) {
			console.error('Error updating manager role:', error);
			throw error;
		}
	};

	const sendInvitation = async (houseId: string, email: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			const invitedByName = user.displayName || user.email || 'Usuário';
			await FirestoreService.sendHouseInvitation(houseId, email, user.uid, invitedByName);
			await loadInvitations(); // Refresh invitations after sending
		} catch (error) {
			console.error('Error sending invitation:', error);
			throw error;
		}
	};

	const acceptInvitation = async (invitationId: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.acceptHouseInvitation(invitationId, user.uid);
			await refreshHouses();
			await loadInvitations();
		} catch (error) {
			console.error('Error accepting invitation:', error);
			throw error;
		}
	};

	const declineInvitation = async (invitationId: string): Promise<void> => {
		if (!user?.uid) throw new Error('User not authenticated');

		try {
			await FirestoreService.declineHouseInvitation(invitationId);
			await loadInvitations();
		} catch (error) {
			console.error('Error declining invitation:', error);
			throw error;
		}
	};

	const value: HouseContextType = {
		currentHouse,
		userHouses,
		userRole,
		isLoading,
		isInitialized,
		isSwitchingHouses,
		createHouse,
		selectHouse,
		updateHouse,
		deleteHouse,
		addManager,
		removeManager,
		updateManagerRole,
		invitations,
		sendInvitation,
		acceptInvitation,
		declineInvitation,
		refreshHouses,
		clearHouseData,
		clearCurrentHouseSelection,
	};

	return (
		<HouseContext.Provider value={value}>
			{children}
		</HouseContext.Provider>
	);
};

export const useHouse = (): HouseContextType => {
	const context = useContext(HouseContext);
	if (context === undefined) {
		throw new Error('useHouse must be used within a HouseProvider');
	}
	return context;
};
