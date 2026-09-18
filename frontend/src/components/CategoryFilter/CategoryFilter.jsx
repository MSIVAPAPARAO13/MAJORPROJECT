import React from 'react';
import { CATEGORIES } from '../../constants/categories';

const CategoryFilter = ({ selectedCategory, onSelectCategory, showTaxes, onToggleTaxes }) => {
  return (
    <div className="d-flex align-items-center justify-content-between my-4 gap-3">
      {/* Category List */}
      <div className="category-filter-container d-flex align-items-center flex-grow-1 pe-2">
        <div
          className={`category-item ${selectedCategory === 'All' ? 'active' : ''}`}
          onClick={() => onSelectCategory('All')}
        >
          <i className="fa-solid fa-layer-group"></i>
          <p>All Stays</p>
        </div>

        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className={`category-item ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.id)}
          >
            <i className={cat.icon}></i>
            <p>{cat.label}</p>
          </div>
        ))}
      </div>

      {/* Tax Toggle */}
      <div className="d-none d-lg-flex align-items-center border rounded-pill px-3 py-2 shadow-sm bg-white text-nowrap">
        <div className="d-flex align-items-center gap-2 m-0">
          <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
            <input
              className="form-check-input m-0 cursor-pointer"
              style={{ float: 'none', width: '2.4rem', height: '1.25rem' }}
              type="checkbox"
              role="switch"
              id="taxSwitch"
              checked={showTaxes}
              onChange={onToggleTaxes}
            />
          </div>
          <label className="small fw-semibold text-secondary cursor-pointer user-select-none m-0 ps-1" htmlFor="taxSwitch">
            Display total after taxes
          </label>
        </div>
      </div>
    </div>
  );
};

export default CategoryFilter;
