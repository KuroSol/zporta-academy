import React, { useContext } from 'react'; // Added useContext
import AsyncSelect from 'react-select/async';
import apiClient from '../../api'; // <-- apiClient import (Adjust path ../../api)
import { AuthContext } from '../../context/AuthContext'; // <-- AuthContext import (Adjust path)

const CreateSubjectSelect = ({ onChange, value }) => {
    const { logout } = useContext(AuthContext); // <-- Use Context

    // This function loads options from your subject API based on the input value.
    const loadOptions = async (inputValue, callback) => {
        if (!inputValue || inputValue.length < 2) { // Added null check for inputValue
            callback([]); // Require at least 2 characters to search.
            return;
        }
        try {
            // Use apiClient.get with relative URL '/subjects/'. Auth handled by interceptor.
            const response = await apiClient.get(`/subjects/?search=${inputValue}`);
            const data = response.data; // Use response.data

            // Map your subject objects into react-select option format.
            let options = [];
            if (Array.isArray(data)) { // Ensure data is an array before mapping
                 options = data.map((subject) => ({
                    label: subject.name,
                    value: subject.id, // Use subject ID as value
                    isNew: false // Mark existing options explicitly
                }));
            } else {
                console.error("Received non-array data for subjects:", data);
            }

            // Add an option that lets the user create a new subject if none matches.
            // Only add if input value isn't exactly matching an existing label (case-insensitive)
            const lowerInputValue = inputValue.toLowerCase();
            const exactMatchFound = options.some(opt => opt.label.toLowerCase() === lowerInputValue);
            if (!exactMatchFound) {
                 options.push({ label: `Create "${inputValue}"`, value: inputValue, isNew: true });
            }

            callback(options);

        } catch (error) {
            console.error('Error fetching subjects', error.response ? error.response.data : error.message);
            callback([]); // Return empty options on error
            // Optionally set an error state in parent or show alert
            // alert('Failed to load subjects.');
            if (error.response?.status === 401) logout(); // Logout on auth error
        }
    };

    // When an option is selected, pass it to the parent component.
    const handleChange = (selectedOption) => {
        onChange(selectedOption); // Pass the whole {value, label, isNew} object up
    };

    // JSX remains the same
    return (
        <AsyncSelect
            cacheOptions
            defaultOptions // Load default options on mount? Might need a separate fetch. Set to false if not needed.
            loadOptions={loadOptions}
            onChange={handleChange}
            value={value}
            placeholder="Type to search or create subject..."
            // Add other react-select props as needed (e.g., styles, classNamePrefix)
            classNamePrefix="react-select"
        />
    );
};

export default CreateSubjectSelect;