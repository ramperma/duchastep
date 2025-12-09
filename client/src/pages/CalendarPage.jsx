import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { API_URL } from '../config';

const locales = {
    'es': es,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const CalendarPage = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await axios.get(`${API_URL}/api/appointments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const formattedEvents = res.data.map(event => ({
                    ...event,
                    start: new Date(event.start),
                    end: new Date(event.end),
                    resourceId: event.id
                }));

                setEvents(formattedEvents);
            } catch (error) {
                console.error("Error fetching calendar events", error);
            }
        };

        fetchEvents();
    }, []);

    const eventStyleGetter = (event) => {
        // Use the colorId we passed from backend (1-11) or default
        // Map Google Colors to CSS Hexcodes roughly
        const googleColors = {
            '1': '#7986cb', // Lavender
            '2': '#33b679', // Sage
            '3': '#8e24aa', // Grape
            '4': '#e67c73', // Flamingo
            '5': '#f6c026', // Banana
            '6': '#f5511d', // Tangerine
            '7': '#039be5', // Peacock
            '8': '#616161', // Graphite
            '9': '#3f51b5', // Blueberry
            '10': '#0b8043', // Basil
            '11': '#d60000', // Tomato
        };

        const backgroundColor = googleColors[event.colorId] || '#3174ad';

        return {
            style: {
                backgroundColor,
                borderRadius: '5px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
            }
        };
    };

    return (
        <div className="h-screen p-4 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4 text-gray-800">Calendario de Visitas</h1>
            <div style={{ height: 'calc(100vh - 120px)' }}>
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    culture='es'
                    eventPropGetter={eventStyleGetter}
                    messages={{
                        next: "Siguiente",
                        previous: "Anterior",
                        today: "Hoy",
                        month: "Mes",
                        week: "Semana",
                        day: "Día",
                        agenda: "Agenda",
                        date: "Fecha",
                        time: "Hora",
                        event: "Evento",
                        noEventsInRange: "Sin eventos en este rango."
                    }}
                />
            </div>
        </div>
    );
};

export default CalendarPage;
