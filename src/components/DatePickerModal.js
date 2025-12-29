import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COLORS = {
  primary: '#FF6B4A',
  background: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  border: '#DDDDDD',
  selected: '#FF6B4A',
  selectedText: '#FFFFFF',
};

const DatePickerModal = ({ visible, onClose, onDateSelect, initialDate = new Date() }) => {
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Generate years (from current year back to 100 years ago)
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  // Get days in selected month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get the day of week for the first day of the month (0 = Sunday)
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDayOfMonth = getFirstDayOfMonth(selectedMonth, selectedYear);

  // Generate calendar grid
  const calendarDays = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  
  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const handleConfirm = () => {
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    onDateSelect(date);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Ensure selected day is valid for the selected month
  useEffect(() => {
    const maxDay = getDaysInMonth(selectedMonth, selectedYear);
    if (selectedDay > maxDay) {
      setSelectedDay(maxDay);
    }
  }, [selectedMonth, selectedYear]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date of Birth</Text>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollableContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Month and Year Selectors */}
            <View style={styles.selectorsContainer}>
            {/* Month Selector */}
            <View style={styles.selectorColumn}>
              <Text style={styles.selectorLabel}>Month</Text>
              <ScrollView 
                style={styles.scrollPicker}
                showsVerticalScrollIndicator={false}
              >
                {MONTHS.map((month, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.pickerItem,
                      selectedMonth === index && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedMonth(index)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedMonth === index && styles.pickerItemTextSelected,
                      ]}
                    >
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Year Selector */}
            <View style={styles.selectorColumn}>
              <Text style={styles.selectorLabel}>Year</Text>
              <ScrollView 
                style={styles.scrollPicker}
                showsVerticalScrollIndicator={false}
              >
                {years.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.pickerItem,
                      selectedYear === year && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedYear === year && styles.pickerItemTextSelected,
                      ]}
                    >
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarContainer}>
            <Text style={styles.calendarTitle}>
              {MONTHS[selectedMonth]} {selectedYear}
            </Text>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.dayHeader}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar days grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    day === selectedDay && styles.dayCellSelected,
                  ]}
                  onPress={() => day && setSelectedDay(day)}
                  disabled={!day}
                >
                  {day && (
                    <Text
                      style={[
                        styles.dayText,
                        day === selectedDay && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: '85%',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  scrollableContent: {
    flexGrow: 0,
    flexShrink: 1,
  },
  selectorsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  selectorColumn: {
    flex: 1,
    marginHorizontal: 8,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  scrollPicker: {
    height: 150,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: COLORS.selected,
  },
  pickerItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  pickerItemTextSelected: {
    color: COLORS.selectedText,
    fontWeight: 'bold',
  },
  calendarContainer: {
    padding: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  dayCellSelected: {
    backgroundColor: COLORS.selected,
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.text,
  },
  dayTextSelected: {
    color: COLORS.selectedText,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.selectedText,
  },
});

export default DatePickerModal;
