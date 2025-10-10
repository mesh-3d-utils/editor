import { memo, ReactNode, useCallback, useState } from 'react'
import {
    Select as MaterialSelect,
    MenuItem,
    FormControl,
    InputLabel,
    Stack,
    useTheme,
    useMediaQuery,
    ToggleButton,
    ToggleButtonGroup,
    SelectChangeEvent,
  } from '@mui/material'

export interface SelectMenuItem {
    value: string
    text: string
    icon: ReactNode
}

export interface SelectProps {
    items: SelectMenuItem[]
    value?: string
    onChange?: (value: string) => void
}

export const Select = memo(({ items, value, onChange }: SelectProps) => {
    const [selectedItem, setSelectedItem] = useState(value ?? items[0].value);

    // 2. Set up the responsive breakpoint
    const theme = useTheme();
    // isMobile will be true if the screen width is less than the 'sm' breakpoint (600px)
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleChange = useCallback((event: SelectChangeEvent<string>) => {
        setSelectedItem(event.target.value);
        onChange?.(event.target.value);
    }, [setSelectedItem]);
  
    // 3. Find the full object for the currently selected item
    const currentSelectedItem = items.find(item => item.value === selectedItem);

    return (
        <FormControl sx={{ m: 1, minWidth: isMobile ? 60 : 150 }}>
            <InputLabel id="responsive-select-label">Menu</InputLabel>
            <MaterialSelect
                labelId="responsive-select-label"
                id="responsive-select"
                value={selectedItem}
                label="Menu"
                onChange={handleChange}
                // 4. The renderValue prop is the key to the solution
                renderValue={() => (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        {currentSelectedItem && currentSelectedItem.icon}
                        {/* On mobile, we hide the text span */}
                        {!isMobile && currentSelectedItem && <span>{currentSelectedItem.text}</span>}
                    </Stack>
                )}
            >
                {/* 5. Map the data to create the menu items for the open dropdown */}
                {items.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            {item.icon}
                            <span>{item.text}</span>
                        </Stack>
                    </MenuItem>
                ))}
            </MaterialSelect>
        </FormControl>
    )
})

export interface MultiSelectProps {
    items: SelectMenuItem[]
    value?: string[]
    onChange?: (value: string[]) => void

    /**
     * if false (default), clicking one item clears selection
     */
    multiselect?: boolean
}

export const MultiSelect = memo(({ items, value, onChange, multiselect = false }: MultiSelectProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleChange = useCallback(
        (_event: React.MouseEvent<HTMLElement>, newValue: string[]) => {
            onChange?.(newValue);
        },
        [onChange]
    );

    return (
        <ToggleButtonGroup
            value={value ?? []}
            onChange={handleChange}
            aria-label="multi select"
            exclusive={multiselect === false}
        >
            {items.map((item) => (
                <ToggleButton value={item.value} key={item.value} aria-label={item.text}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {item.icon}
                        {!isMobile && <span>{item.text}</span>}
                    </Stack>
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
})
