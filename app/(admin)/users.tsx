import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  created_at: string;
  is_banned?: boolean;
  is_suspended?: boolean;
  suspension_reason?: string;
}

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendDays, setSuspendDays] = useState('7');
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleBanUser = async (userId: string, name: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to BAN ${name}?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Ban User',
            `Are you sure you want to BAN ${name}?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Ban', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await api.put(`/admin/users/${userId}/ban`, {});
      if (Platform.OS === 'web') {
        window.alert('User banned successfully');
      } else {
        Alert.alert('Success', 'User banned successfully');
      }
      fetchUsers();
    } catch (error: any) {
      console.error('Error banning user:', error);
      const message = error.response?.data?.detail || 'Failed to ban user';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanUser = async (userId: string, name: string) => {
    setActionLoading(true);
    try {
      await api.put(`/admin/users/${userId}/unban`, {});
      if (Platform.OS === 'web') {
        window.alert('User unbanned successfully');
      } else {
        Alert.alert('Success', 'User unbanned successfully');
      }
      fetchUsers();
    } catch (error: any) {
      console.error('Error unbanning user:', error);
      const message = error.response?.data?.detail || 'Failed to unban user';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/suspend`, {
        days: parseInt(suspendDays) || 7,
        reason: suspendReason || 'Violation of terms',
      });
      if (Platform.OS === 'web') {
        window.alert('User suspended successfully');
      } else {
        Alert.alert('Success', 'User suspended successfully');
      }
      setShowSuspendModal(false);
      setSuspendDays('7');
      setSuspendReason('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error suspending user:', error);
      const message = error.response?.data?.detail || 'Failed to suspend user';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'customer':
        return 'person';
      case 'restaurant':
        return 'restaurant';
      case 'rider':
        return 'bicycle';
      case 'admin':
        return 'shield-checkmark';
      default:
        return 'person';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'customer':
        return '#2196F3';
      case 'restaurant':
        return '#4CAF50';
      case 'rider':
        return '#9C27B0';
      case 'admin':
        return '#210059';
      default:
        return '#999';
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={[styles.roleIcon, { backgroundColor: getRoleColor(item.role) + '20' }]}>
        <Ionicons name={getRoleIcon(item.role) as any} size={24} color={getRoleColor(item.role)} />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        {item.phone && <Text style={styles.userPhone}>{item.phone}</Text>}
        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
            <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
          </View>
          {item.is_banned && (
            <View style={[styles.statusBadge, { backgroundColor: '#F44336' }]}>
              <Text style={styles.statusBadgeText}>BANNED</Text>
            </View>
          )}
          {item.is_suspended && (
            <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
              <Text style={styles.statusBadgeText}>SUSPENDED</Text>
            </View>
          )}
        </View>
        {item.suspension_reason && (
          <Text style={styles.suspendReason}>Reason: {item.suspension_reason}</Text>
        )}
        {item.role !== 'admin' && (
          <View style={styles.actionButtons}>
            {item.is_banned ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.unbanButton]}
                onPress={() => handleUnbanUser(item.id, item.name)}
                disabled={actionLoading}
              >
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.unbanText}>Unban</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.suspendButton]}
                  onPress={() => {
                    setSelectedUser(item);
                    setShowSuspendModal(true);
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons name="time" size={16} color="#FF9800" />
                  <Text style={styles.suspendText}>Suspend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.banButton]}
                  onPress={() => handleBanUser(item.id, item.name)}
                  disabled={actionLoading}
                >
                  <Ionicons name="ban" size={16} color="#F44336" />
                  <Text style={styles.banText}>Ban</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
        }
      />

      {/* Suspend Modal */}
      <Modal
        visible={showSuspendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuspendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suspend User</Text>
              <TouchableOpacity onPress={() => setShowSuspendModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Suspend for (days):</Text>
              <TextInput
                style={styles.modalInput}
                value={suspendDays}
                onChangeText={setSuspendDays}
                keyboardType="numeric"
                placeholder="7"
              />
              <Text style={styles.modalLabel}>Reason:</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={suspendReason}
                onChangeText={setSuspendReason}
                placeholder="Violation of terms"
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity
                style={styles.suspendSubmitButton}
                onPress={handleSuspendUser}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.suspendSubmitText}>Suspend User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  suspendReason: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  suspendButton: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  suspendText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
  },
  banButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  banText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  unbanButton: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  unbanText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 400,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  suspendSubmitButton: {
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  suspendSubmitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
