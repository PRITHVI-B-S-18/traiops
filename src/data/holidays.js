// Indian Holidays 2024
export const holidays = {
  '2024-01-01': 'New Year\'s Day',
  '2024-01-26': 'Republic Day',
  '2024-03-08': 'Holi',
  '2024-03-25': 'Ram Navami',
  '2024-04-09': 'Mahavir Jayanti',
  '2024-04-11': 'Good Friday',
  '2024-05-01': 'Labour Day',
  '2024-08-15': 'Independence Day',
  '2024-10-02': 'Gandhi Jayanti',
  '2024-11-01': 'Diwali',
  '2024-12-25': 'Christmas Day'
};

// Function to check if a date is a holiday
export const isHoliday = (date) => {
  const dateStr = date.toISOString().split('T')[0];
  return holidays[dateStr];
};

// Function to get holiday name
export const getHolidayName = (date) => {
  const dateStr = date.toISOString().split('T')[0];
  return holidays[dateStr];
};

// Function to get all holidays in a date range
export const getHolidaysInRange = (startDate, endDate) => {
  const holidaysInRange = {};
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (holidays[dateStr]) {
      holidaysInRange[dateStr] = holidays[dateStr];
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return holidaysInRange;
}; 