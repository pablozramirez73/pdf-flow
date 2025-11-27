import csv
import io
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.secret_key = 'supersecretkey' # Change this in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///employees.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50))
    surname = db.Column(db.String(100))
    name = db.Column(db.String(100))
    fiscal_code = db.Column(db.String(16))
    hiring_date = db.Column(db.Date, nullable=True)
    termination_date = db.Column(db.Date, nullable=True)
    job_title = db.Column(db.String(100))
    birth_place = db.Column(db.String(100))
    birth_date = db.Column(db.Date, nullable=True)
    email = db.Column(db.String(120))

def parse_date(date_str):
    if not date_str or not date_str.strip():
        return None
    try:
        # Try DD/MM/YYYY first
        return datetime.strptime(date_str.strip(), '%d/%m/%Y').date()
    except ValueError:
        try:
            # Try YYYY-MM-DD (HTML5 date input format)
            return datetime.strptime(date_str.strip(), '%Y-%m-%d').date()
        except ValueError:
            return None

with app.app_context():
    db.create_all()

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part', 'danger')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No selected file', 'danger')
            return redirect(request.url)
        if file:
            try:
                stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
                csv_input = csv.DictReader(stream, delimiter=';')
                count = 0
                for row in csv_input:
                    employee = Employee(
                        code=row.get('Dipendente'),
                        surname=row.get('Cognome'),
                        name=row.get('Nome'),
                        fiscal_code=row.get('Codice fiscale'),
                        hiring_date=parse_date(row.get('Data assunzione')),
                        termination_date=parse_date(row.get('Data cessazione')),
                        job_title=row.get('Mansione').strip() if row.get('Mansione') else None,
                        birth_place=row.get('Dati di nascita - Localita').strip() if row.get('Dati di nascita - Localita') else None,
                        birth_date=parse_date(row.get('Data di nascita')),
                        email=row.get('Domicilio fis./Residenza - E-mail').strip() if row.get('Domicilio fis./Residenza - E-mail') else None
                    )
                    db.session.add(employee)
                    count += 1
                db.session.commit()
                flash(f'Successfully uploaded {count} employees!', 'success')
            except Exception as e:
                flash(f'Error processing file: {str(e)}', 'danger')
            return redirect(url_for('index'))
    
    employees = Employee.query.all()
    return render_template('index.html', employees=employees)

@app.route('/edit/<int:id>', methods=['GET', 'POST'])
def edit_employee(id):
    employee = Employee.query.get_or_404(id)
    if request.method == 'POST':
        employee.code = request.form['code']
        employee.surname = request.form['surname']
        employee.name = request.form['name']
        employee.fiscal_code = request.form['fiscal_code']
        employee.hiring_date = parse_date(request.form['hiring_date'])
        employee.termination_date = parse_date(request.form['termination_date'])
        employee.job_title = request.form['job_title']
        employee.birth_place = request.form['birth_place']
        employee.birth_date = parse_date(request.form['birth_date'])
        employee.email = request.form['email']
        
        try:
            db.session.commit()
            flash('Employee updated successfully!', 'success')
            return redirect(url_for('index'))
        except Exception as e:
            flash(f'Error updating employee: {str(e)}', 'danger')
            
    return render_template('edit.html', employee=employee)

@app.route('/delete/<int:id>', methods=['POST'])
def delete_employee(id):
    employee = Employee.query.get_or_404(id)
    try:
        db.session.delete(employee)
        db.session.commit()
        flash('Employee deleted successfully!', 'success')
    except Exception as e:
        flash(f'Error deleting employee: {str(e)}', 'danger')
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)

