export interface DaySchedule {
  day: string;
  shortDay: string;
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  openTime: string; // e.g. "12:00 PM"
  closeTime: string; // e.g. "11:00 PM"
  openHour: number; // 24-hour e.g. 12
  openMinute: number;
  closeHour: number; // 24-hour e.g. 23
  closeMinute: number;
  isOpen: boolean;
}

export const WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    day: "Monday",
    shortDay: "Mon",
    dayIndex: 1,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
  {
    day: "Tuesday",
    shortDay: "Tue",
    dayIndex: 2,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
  {
    day: "Wednesday",
    shortDay: "Wed",
    dayIndex: 3,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
  {
    day: "Thursday",
    shortDay: "Thu",
    dayIndex: 4,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
  {
    day: "Friday",
    shortDay: "Fri",
    dayIndex: 5,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
  {
    day: "Saturday",
    shortDay: "Sat",
    dayIndex: 6,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
  {
    day: "Sunday",
    shortDay: "Sun",
    dayIndex: 0,
    openTime: "12:00 PM",
    closeTime: "11:00 PM",
    openHour: 12,
    openMinute: 0,
    closeHour: 23,
    closeMinute: 0,
    isOpen: true,
  },
];

export interface RestaurantStatus {
  isOpen: boolean;
  statusText: string;
  subText: string;
  todaySchedule: DaySchedule;
  currentDayIndex: number;
}

export function getRestaurantStatus(date: Date = new Date()): RestaurantStatus {
  const currentDayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMinute;

  const todaySchedule =
    WEEKLY_SCHEDULE.find((d) => d.dayIndex === currentDayIndex) || WEEKLY_SCHEDULE[0];

  const openTimeVal = todaySchedule.openHour * 60 + todaySchedule.openMinute;
  const closeTimeVal = todaySchedule.closeHour * 60 + todaySchedule.closeMinute;

  const isOpen = currentTimeVal >= openTimeVal && currentTimeVal < closeTimeVal;

  let statusText = "Closed Now";
  let subText = `Opens today at ${todaySchedule.openTime}`;

  if (isOpen) {
    statusText = "Open Now";
    const minutesLeft = closeTimeVal - currentTimeVal;
    if (minutesLeft <= 60 && minutesLeft > 0) {
      subText = `Closing soon in ${minutesLeft} mins (${todaySchedule.closeTime})`;
    } else {
      subText = `Closes at ${todaySchedule.closeTime}`;
    }
  } else if (currentTimeVal >= closeTimeVal) {
    // After closing for the day, check tomorrow
    const tomorrowIndex = (currentDayIndex + 1) % 7;
    const tomorrowSchedule =
      WEEKLY_SCHEDULE.find((d) => d.dayIndex === tomorrowIndex) || WEEKLY_SCHEDULE[0];
    statusText = "Closed for Today";
    subText = `Opens tomorrow at ${tomorrowSchedule.openTime}`;
  } else {
    // Before opening today
    statusText = "Closed Now";
    subText = `Opens today at ${todaySchedule.openTime}`;
  }

  return {
    isOpen,
    statusText,
    subText,
    todaySchedule,
    currentDayIndex,
  };
}
