import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { API_URL } from '../config';
import { Filter, CheckSquare, Square } from 'lucide-react';

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

// Helper to generate a consistent color from a string (Commercial Name)
const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Pastel/Pleasant colors logic
    const h = hash % 360;
    return `hsl(${h}, 70%, 50%)`; // HSL for vibrant but readable colors
};

const CalendarPage = () => {
    const [events, setEvents] = useState([]);
    const [allCommercials, setAllCommercials] = useState([]);
    const [selectedCommercials, setSelectedCommercials] = useState(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await axios.get(`${API_URL}/api/appointments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const formattedEvents = res.data.map(event => {
                    // Extract Commercial Name from Title: "[NAME] ..."
                    const match = event.title.match(/^\[(.*?)\]/);
                    const commercialName = match ? match[1] : 'Otros';

                    return {
                        ...event,
                        start: new Date(event.start),
                        end: new Date(event.end),
                        resourceId: event.id,
                        commercialName: commercialName
                    };
                });

                setEvents(formattedEvents);

                // Extract unique commercials
                const commercials = [...new Set(formattedEvents.map(e => e.commercialName))].sort();
                setAllCommercials(commercials);
                // Select all by default
                setSelectedCommercials(new Set(commercials));

            } catch (error) {
                console.error("Error fetching calendar events", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const toggleCommercial = (name) => {
        const newSet = new Set(selectedCommercials);
        if (newSet.has(name)) {
            newSet.delete(name);
        } else {
            newSet.add(name);
        }
        setSelectedCommercials(newSet);
    };

    const filteredEvents = useMemo(() => {
        return events.filter(e => selectedCommercials.has(e.commercialName));
    }, [events, selectedCommercials]);

    const eventStyleGetter = (event) => {
        const backgroundColor = stringToColor(event.commercialName);
        return {
            style: {
                backgroundColor,
                borderRadius: '4px',
                opacity: 0.9,
                color: 'white',
                border: '0px',
                display: 'block',
                fontSize: '0.85em'
            }
        };
    };

    const handleSelectEvent = (event) => {
        if (event.htmlLink) {
            window.open(event.htmlLink, '_blank');
        }
    };

    const [view, setView] = useState('month');
    const [date, setDate] = useState(new Date());

    const onNavigate = (newDate) => setDate(newDate);
    const onView = (newView) => setView(newView);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            {/* Sidebar Filters */}
            <div
                className={`${isSidebarOpen ? 'w-64' : 'w-12'} bg-white border-r flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out`}
            >
                <div className="p-4 border-b flex items-center justify-between">
                    {isSidebarOpen && (
                        <div className="flex items-center gap-2 text-gray-700 overflow-hidden whitespace-nowrap">
                            <Filter className="w-5 h-5 flex-shrink-0" />
                            <h2 className="font-bold text-lg">Filtros</h2>
                        </div>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500 mx-auto"
                        title={isSidebarOpen ? "Ocultar filtros" : "Mostrar filtros"}
                    >
                        {isSidebarOpen ? <Square className="w-4 h-4 fill-gray-400" /> : <Filter className="w-5 h-5" />}
                    </button>
                </div>

                {isSidebarOpen && (
                    <div className="flex-1 overflow-y-auto p-4">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Comerciales</h3>
                        <div className="space-y-2">
                            {allCommercials.map(name => (
                                <button
                                    key={name}
                                    onClick={() => toggleCommercial(name)}
                                    className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div
                                        className={`w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${selectedCommercials.has(name) ? 'border-transparent' : 'border-gray-300'}`}
                                        style={{ backgroundColor: selectedCommercials.has(name) ? stringToColor(name) : 'transparent' }}
                                    >
                                        {selectedCommercials.has(name) && <CheckSquare className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className={`text-sm truncate ${selectedCommercials.has(name) ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                                        {name}
                                    </span>
                                </button>
                            ))}
                            {allCommercials.length === 0 && !loading && (
                                <p className="text-sm text-gray-400 italic">No hay comerciales activos.</p>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t">
                            <button
                                onClick={() => setSelectedCommercials(new Set(allCommercials))}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium block w-full text-left mb-2"
                            >
                                Seleccionar Todos
                            </button>
                            <button
                                onClick={() => setSelectedCommercials(new Set())}
                                className="text-xs text-gray-500 hover:text-gray-700 block w-full text-left"
                            >
                                Deseleccionar Todos
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col h-full min-w-0">
                <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Calendario de Visitas</h1>
                    <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                        {filteredEvents.length} visitas
                    </span>
                </div>

                <div className="flex-1 p-4 overflow-hidden">
                    <div className="h-full bg-white rounded-lg shadow-sm p-4">
                        <BigCalendar
                            localizer={localizer}
                            events={filteredEvents}
                            startAccessor="start"
                            endAccessor="end"
                            style={{ height: '100%' }}
                            culture='es'
                            eventPropGetter={eventStyleGetter}
                            onSelectEvent={handleSelectEvent}
                            view={view}
                            date={date}
                            onNavigate={onNavigate}
                            onView={onView}
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
            </div>
        </div>
    );
};

export default CalendarPage;
